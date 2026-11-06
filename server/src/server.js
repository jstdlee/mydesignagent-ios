// The library server: one per machine, serving every registered project's artifacts to the
// Design Agent app (JSON API under /api/v1) and to browsers (pages, artboard options, the kit).
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { sameSecret } from "./ids.js";
import { BRIDGE_JS, KIT_JS, framePage, injectBridge } from "./kit.js";
import { listProjects, serverKey } from "./registry.js";
import * as store from "./store.js";

export const VERSION = "0.1.0";
export const PROTOCOL = 1;
const MAX_BODY = 1024 * 1024;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const isLoopback = (address) => address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";

function cookies(req) {
  const out = {};
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new HttpError(413, "E_TOO_LARGE", "request body is larger than 1 MB");
    chunks.push(chunk);
  }
  if (!size) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "E_JSON", "request body is not JSON");
  }
}

function send(res, status, body, headers = {}) {
  const isJson = typeof body !== "string" && !Buffer.isBuffer(body);
  const payload = isJson ? JSON.stringify(body) : body;
  res.writeHead(status, {
    "content-type": isJson ? "application/json; charset=utf-8" : "text/html; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    ...headers,
  });
  res.end(payload);
}

const sendError = (res, status, code, message) => send(res, status, { error: { code, message } });

/** Change detection for a set of artifact directories: a hash of every file's path, mtime and size. */
function fingerprint(dirs) {
  const hash = crypto.createHash("sha1");
  for (const dir of [...dirs].sort()) {
    hash.update(dir);
    for (const [file, mtime, size] of store.fileStamps(dir)) hash.update(`${file}:${mtime}:${size};`);
  }
  return hash.digest("hex").slice(0, 16);
}

/**
 * Creates the server. `home` is the server home (projects.json, key); `requireKeyOnLoopback`
 * makes local requests show the key too (tests use it).
 */
export function createServer({ home, requireKeyOnLoopback = false, log = () => {} }) {
  const key = serverKey(home);

  /** Every registered project and its artifact directories. */
  function scan() {
    return listProjects(home).map((p) => ({ ...p, dirs: store.artifactDirs(p.dir) }));
  }

  function locate(id) {
    for (const project of scan()) {
      const dir = store.findArtifact(project.dir, id);
      if (dir) return { project, dir };
    }
    throw new HttpError(404, "E_NOT_FOUND", `no artifact ${id}`);
  }

  /** Links the app and browsers open, relative to the server. */
  function withLinks(artifact, dir) {
    const id = artifact.id;
    const content = artifact.content;
    const fileUrl = (name) => `/a/${id}/files/${name.split("/").map(encodeURIComponent).join("/")}`;
    if (artifact.type === "artboard") {
      content.questions = content.questions.map((q) => ({
        ...q,
        options: (q.options ?? []).map((o) => ({
          ...o,
          html: undefined,
          url: `/a/${id}/option/${encodeURIComponent(q.id)}/${encodeURIComponent(o.id)}`,
          imageUrl: o.image ? fileUrl(o.image) : undefined,
        })),
      }));
    } else if (artifact.type === "verify") {
      content.groups = content.groups.map((g) => ({
        ...g,
        design: { url: `/a/${id}/verify/${encodeURIComponent(g.id)}/design`, imageUrl: g.design?.image ? fileUrl(g.design.image) : undefined },
        built: { url: `/a/${id}/verify/${encodeURIComponent(g.id)}/built`, imageUrl: g.built?.image ? fileUrl(g.built.image) : undefined },
      }));
    } else if (artifact.type === "html") {
      content.html = undefined;
      // The page's own modification time: a rewrite by the agent changes the URL, a control value does not.
      const stamp = Math.round(fs.statSync(path.join(dir, "index.html"), { throwIfNoEntry: false })?.mtimeMs ?? 0);
      content.pageUrl = `/a/${id}/page?v=${stamp}`;
    }
    return artifact;
  }

  function sidePage(id, dir, title, side) {
    if (!side) return framePage(title, "<p>Nothing here yet.</p>");
    if (side.image) return framePage(title, `<img class="full" src="/a/${id}/files/${encodeURI(side.image)}" alt="">`);
    if (side.file) {
      const file = store.artifactFile(dir, side.file);
      if (!file) throw new HttpError(404, "E_NOT_FOUND", `missing ${side.file}`);
      return fs.readFileSync(file, "utf8");
    }
    return framePage(title, side.html ?? "");
  }

  async function api(req, res, url, parts) {
    const method = req.method;
    if (parts[0] === "library" && method === "GET") {
      const projects = scan();
      const revision = fingerprint(projects.flatMap((p) => p.dirs));
      if (url.searchParams.get("since") === revision) return send(res, 200, { revision, unchanged: true });
      const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
      const type = url.searchParams.get("type");
      const sort = url.searchParams.get("sort") ?? "newest";
      let items = projects.flatMap((p) => p.dirs.map((d) => store.summarize(p.dir, d)));
      if (type && store.ARTIFACT_TYPES.includes(type)) items = items.filter((a) => a.type === type);
      if (q) items = items.filter((a) => `${a.title} ${a.id} ${a.slug} ${a.project.name}`.toLowerCase().includes(q));
      items.sort((a, b) =>
        sort === "name" ? a.title.localeCompare(b.title) : sort === "oldest" ? a.updatedAt.localeCompare(b.updatedAt) : b.updatedAt.localeCompare(a.updatedAt),
      );
      return send(res, 200, {
        revision,
        projects: projects.map((p) => ({ dir: p.dir, name: p.name, count: p.dirs.length })),
        items,
      });
    }
    if (parts[0] !== "artifacts" || !parts[1]) throw new HttpError(404, "E_ROUTE", "no such route");
    const { project, dir } = locate(decodeURIComponent(parts[1]));
    const action = parts[2];
    if (!action && method === "GET") {
      const revision = fingerprint([dir]);
      if (url.searchParams.get("since") === revision) return send(res, 200, { revision, unchanged: true });
      return send(res, 200, { revision, artifact: withLinks(store.readArtifact(project.dir, dir), dir) });
    }
    const body = method === "GET" ? {} : await readBody(req);
    const reply = (result, status = 200) => send(res, status, { result, artifact: withLinks(store.readArtifact(project.dir, dir), dir), revision: fingerprint([dir]) });
    switch (`${method} ${action}`) {
      case "POST comments":
        return reply(store.addComment(project.dir, dir, body), 201);
      case "PATCH comments":
        return reply(store.resolveComment(project.dir, dir, { commentId: decodeURIComponent(parts[3] ?? ""), resolved: body.resolved }));
      case "PUT answers":
        return reply(store.setAnswer(project.dir, dir, body));
      case "POST rounds":
        return reply(store.submitRound(project.dir, dir, body), 201);
      case "PUT blocks":
        return reply(store.editBlock(project.dir, dir, { blockId: decodeURIComponent(parts[3] ?? ""), text: body.text }));
      case "PUT verdicts":
        return reply(store.setVerdict(project.dir, dir, body));
      case "PUT state":
        return reply(store.setState(project.dir, dir, body.values));
    }
    throw new HttpError(404, "E_ROUTE", "no such route");
  }

  function page(req, res, parts) {
    // /a/:id/page | /a/:id/option/:q/:o | /a/:id/verify/:g/:side | /a/:id/files/...
    const { project, dir } = locate(decodeURIComponent(parts[0]));
    const artifact = store.readArtifact(project.dir, dir);
    const stateUrl = `/api/v1/artifacts/${artifact.id}/state`;
    const html = (text) => send(res, 200, injectBridge(text, { stateUrl, state: artifact.feedback.state }));
    switch (parts[1]) {
      case "page":
        if (artifact.type !== "html") break;
        return html(fs.readFileSync(path.join(dir, "index.html"), "utf8"));
      case "option": {
        const q = artifact.content.questions?.find((x) => x.id === decodeURIComponent(parts[2] ?? ""));
        const o = q?.options?.find((x) => x.id === decodeURIComponent(parts[3] ?? ""));
        if (!o) break;
        return html(sidePage(artifact.id, dir, o.title ?? o.id, o));
      }
      case "verify": {
        const g = artifact.content.groups?.find((x) => x.id === decodeURIComponent(parts[2] ?? ""));
        const side = parts[3] === "design" || parts[3] === "built" ? parts[3] : null;
        if (!g || !side) break;
        return html(sidePage(artifact.id, dir, `${g.title ?? g.id} — ${side}`, g[side]));
      }
      case "files": {
        const file = store.artifactFile(dir, parts.slice(2).map(decodeURIComponent).join("/"));
        if (!file) break;
        res.writeHead(200, { "content-type": MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream", "cache-control": "no-cache" });
        return fs.createReadStream(file).pipe(res);
      }
    }
    throw new HttpError(404, "E_NOT_FOUND", "no such page");
  }

  function indexPage() {
    const rows = scan()
      .flatMap((p) => p.dirs.map((d) => store.summarize(p.dir, d)))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((a) => {
        const href = a.type === "html" ? `/a/${a.id}/page` : `/api/v1/artifacts/${a.id}`;
        return `<li><a href="${href}">${store.escapeHtml(a.title)}</a> <small>${a.type} · ${store.escapeHtml(a.project.name)} · ${a.updatedAt.slice(0, 16).replace("T", " ")}</small></li>`;
      })
      .join("\n");
    return framePage("Design Agent artifacts", `<main style="padding:24px"><h1>Artifacts</h1><p>Open the Design Agent app to review, comment and verify.</p><ul>${rows || "<li>No artifacts yet.</li>"}</ul></main>`);
  }

  return http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const parts = url.pathname.split("/").filter(Boolean);
    try {
      if (url.pathname === "/api/v1/info") {
        return send(res, 200, { name: "designagent-artifacts", version: VERSION, protocol: PROTOCOL });
      }
      if (url.pathname === "/kit.js") return send(res, 200, KIT_JS, { "content-type": "text/javascript; charset=utf-8", "cache-control": "max-age=300" });
      if (url.pathname === "/bridge.js") return send(res, 200, BRIDGE_JS, { "content-type": "text/javascript; charset=utf-8", "cache-control": "max-age=300" });

      const bearer = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
      const queryKey = url.searchParams.get("key");
      const authorized =
        sameSecret(bearer, key) || sameSecret(queryKey, key) || sameSecret(cookies(req).designagent_key, key) ||
        (!requireKeyOnLoopback && isLoopback(req.socket.remoteAddress));
      if (!authorized) return sendError(res, 401, "E_AUTH", "pair this device: run `designagent-artifacts pair` on the computer and enter its key");
      // A page opened with ?key= gets a cookie, so its own images, scripts and state writes are authorized.
      if (sameSecret(queryKey, key)) res.setHeader("set-cookie", `designagent_key=${encodeURIComponent(key)}; Path=/; HttpOnly; SameSite=Lax`);

      if (parts[0] === "api" && parts[1] === "v1") return await api(req, res, url, parts.slice(2));
      if (parts[0] === "a" && parts.length >= 2) return page(req, res, parts.slice(1));
      if (url.pathname === "/") return send(res, 200, indexPage());
      throw new HttpError(404, "E_ROUTE", "no such route");
    } catch (error) {
      if (error instanceof HttpError || error instanceof store.StoreError) return sendError(res, error.status, error.code, error.message);
      log(`500 ${req.method} ${url.pathname}: ${error.stack ?? error}`);
      return sendError(res, 500, "E_INTERNAL", error.message);
    }
  });
}

/** Listens on the first free port of `ports`; resolves with the port. */
export function listen(server, ports, host) {
  return new Promise((resolve, reject) => {
    const tryAt = (i) => {
      if (i >= ports.length) return reject(new Error(`ports ${ports.join(", ")} are all in use`));
      const onError = (error) => {
        server.off("listening", onListening);
        if (error.code === "EADDRINUSE") tryAt(i + 1);
        else reject(error);
      };
      const onListening = () => {
        server.off("error", onError);
        resolve(server.address().port);
      };
      server.once("error", onError);
      server.once("listening", onListening);
      server.listen(ports[i], host);
    };
    tryAt(0);
  });
}
