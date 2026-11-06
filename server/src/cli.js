// designagent-artifacts: the command line agents and people use to run the library server,
// create artifacts, and read what the person said in the app.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { candidatePorts, findProjectRoot, serverHome } from "./paths.js";
import { infoFile, listProjects, readServerInfo, registerProject, serverKey } from "./registry.js";
import { PROTOCOL, VERSION, createServer, listen } from "./server.js";
import * as store from "./store.js";

const BIN = fileURLToPath(new URL("../bin/designagent-artifacts.js", import.meta.url));
const FORMATS = ["brief", "table", "json", "jsonl"];

const HELP = `designagent-artifacts ${VERSION}

Usage:
  designagent-artifacts [project-dir]       Register the project and run the library server (Ctrl+C stops it)
  designagent-artifacts start               Start the server in the background (--foreground to stay)
  designagent-artifacts stop                Stop the server
  designagent-artifacts status              Show the server, its address and projects
  designagent-artifacts pair                Show the address and key the iOS app pairs with
  designagent-artifacts new <type> <slug>   Create an artifact: artboard, document, html or verify
  designagent-artifacts list                List the project's artifacts
  designagent-artifacts show <ref>          Print one artifact (ref: id or type/slug)
  designagent-artifacts inbox               Comments, rounds, edits and verdicts not acknowledged yet
  designagent-artifacts ack <receipt>...    Acknowledge inbox events (--all for every one)

Options:
  --project-dir DIR   The project (default: the enclosing repository of the current directory)
  --port N            Listen on N (default: first free of ${candidatePorts().join(", ")})
  --host HOST         Listen address (default 127.0.0.1; 0.0.0.0 lets a phone on the LAN connect)
  --title TEXT        new: the artifact's title
  --from FILE         new: start from this file's content instead of the template
  --all               inbox: include acknowledged events; ack: acknowledge every pending event
  --type TYPE         list: only this type
  --format FMT        brief | table | json | jsonl (default brief, or DESIGNAGENT_ARTIFACTS_FORMAT)
  --json              Same as --format json
  --quiet             Print nothing on success

Environment: DESIGNAGENT_SERVER_HOME, DESIGNAGENT_ARTIFACTS_PORTS, DESIGNAGENT_ARTIFACTS_FORMAT
`;

class UsageError extends Error {}

export function parseArgs(argv) {
  const flags = {};
  const positional = [];
  const valued = new Set(["project-dir", "port", "host", "title", "from", "type", "format"]);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--") {
      positional.push(...argv.slice(i + 1));
      break;
    }
    if (arg.startsWith("--")) {
      const [name, inline] = arg.slice(2).split(/=(.*)/s, 2);
      if (valued.has(name)) {
        const value = inline ?? argv[++i];
        if (value === undefined) throw new UsageError(`--${name} needs a value`);
        flags[name] = value;
      } else flags[name] = true;
    } else if (arg === "-h") flags.help = true;
    else positional.push(arg);
  }
  return { flags, positional };
}

// ---------------------------------------------------------------------------------------------
// Output

function makeOutput(flags, command, out = process.stdout) {
  const format = flags.json ? "json" : (flags.format ?? process.env.DESIGNAGENT_ARTIFACTS_FORMAT ?? "brief");
  if (!FORMATS.includes(format)) throw new UsageError(`--format is one of ${FORMATS.join(", ")}`);
  const write = (line) => out.write(`${line}\n`);
  return {
    format,
    /** Emits a result: `data` for json, `items` for lists, `brief` lines for people. */
    result({ data, items, columns, brief }) {
      if (flags.quiet) return;
      if (format === "json") return write(JSON.stringify({ schema: "designagent.cli/v1", ok: true, command, data: data ?? items }, null, 2));
      if (format === "jsonl") {
        write(JSON.stringify({ kind: "meta", schema: "designagent.cli/v1", command }));
        for (const item of items ?? []) write(JSON.stringify({ kind: "item", item }));
        return write(JSON.stringify({ kind: "result", ok: true, data: items ? { count: items.length } : data }));
      }
      if (format === "table" && items && columns) {
        const rows = [columns, ...items.map((item) => columns.map((c) => String(item[c] ?? "")))];
        const widths = columns.map((_, i) => Math.max(...rows.map((r) => r[i].length)));
        for (const row of rows) write(row.map((cell, i) => cell.padEnd(widths[i])).join("  ").trimEnd());
        return;
      }
      for (const line of [].concat(brief ?? [])) write(line);
    },
  };
}

// ---------------------------------------------------------------------------------------------
// The running server

async function probe(info, timeoutMs = 800) {
  if (!info?.port) return null;
  try {
    const res = await fetch(`http://127.0.0.1:${info.port}/api/v1/info`, { signal: AbortSignal.timeout(timeoutMs) });
    const body = await res.json();
    return body?.name === "designagent-artifacts" ? info : null;
  } catch {
    return null;
  }
}

export async function runningServer(home) {
  return probe(readServerInfo(home));
}

function lanAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((a) => a && a.family === "IPv4" && !a.internal)
    .map((a) => a.address);
}

function localUrl(info) {
  return `http://127.0.0.1:${info.port}`;
}

async function serveForeground(home, flags) {
  const ports = flags.port ? [Number(flags.port)] : candidatePorts();
  const host = flags.host ?? "127.0.0.1";
  const logFile = path.join(home, "server.log");
  const log = (line) => fs.appendFileSync(logFile, `${new Date().toISOString()} ${line}\n`);
  const server = createServer({ home, log });
  const port = await listen(server, ports, host);
  const info = { pid: process.pid, port, host, version: VERSION, protocol: PROTOCOL, startedAt: new Date().toISOString() };
  fs.writeFileSync(infoFile(home), `${JSON.stringify(info, null, 2)}\n`);
  log(`listening on ${host}:${port}`);
  const stop = (code) => {
    try {
      if (readServerInfo(home)?.pid === process.pid) fs.rmSync(infoFile(home), { force: true });
    } catch {}
    server.close();
    process.exit(code);
  };
  process.once("SIGINT", () => stop(130));
  process.once("SIGTERM", () => stop(143));
  return info;
}

async function startBackground(home, flags) {
  const args = [BIN, "serve"];
  if (flags.port) args.push("--port", String(flags.port));
  if (flags.host) args.push("--host", flags.host);
  const logFd = fs.openSync(path.join(home, "server.log"), "a");
  const child = spawn(process.execPath, args, { detached: true, stdio: ["ignore", logFd, logFd], env: process.env });
  child.unref();
  fs.closeSync(logFd);
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 100));
    const info = readServerInfo(home);
    if (info?.pid === child.pid && (await probe(info))) return info;
  }
  throw new Error(`the server did not start; see ${path.join(home, "server.log")}`);
}

// ---------------------------------------------------------------------------------------------
// Commands

function projectDir(flags) {
  return findProjectRoot(flags["project-dir"] ?? process.cwd());
}

function resolveRef(dir, ref) {
  if (!ref) throw new UsageError("name an artifact: its id or type/slug");
  const found = store.findArtifact(dir, ref);
  if (!found) throw new Error(`no artifact ${ref} in ${dir}`);
  return found;
}

async function cmdOpen(home, flags, out, positional) {
  if (positional[0] && !fs.statSync(positional[0], { throwIfNoEntry: false })?.isDirectory()) {
    throw new UsageError(`unknown command or directory "${positional[0]}"; see --help`);
  }
  const dir = registerProject(home, findProjectRoot(positional[0] ?? flags["project-dir"] ?? process.cwd()));
  const running = await runningServer(home);
  if (running) {
    out.result({ data: { reused: true, url: localUrl(running), project: dir }, brief: [`Library: ${localUrl(running)} (already running)`, `Project: ${dir}`] });
    return 0;
  }
  const info = await serveForeground(home, flags);
  out.result({
    data: { reused: false, url: localUrl(info), project: dir },
    brief: [`Library: ${localUrl(info)}`, `Project: ${dir}`, "Pair the iOS app: designagent-artifacts pair    Stop: Ctrl+C"],
  });
  return new Promise(() => {}); // runs until a signal stops it
}

async function cmdStart(home, flags, out) {
  const dir = registerProject(home, projectDir(flags));
  const running = await runningServer(home);
  if (running) {
    out.result({ data: { reused: true, url: localUrl(running), ...running }, brief: `Library: ${localUrl(running)} (already running)` });
    return 0;
  }
  if (flags.foreground) return cmdOpen(home, flags, out, [dir]);
  const info = await startBackground(home, flags);
  out.result({ data: { reused: false, url: localUrl(info), ...info }, brief: [`Library: ${localUrl(info)} (pid ${info.pid})`, `Project: ${dir}`] });
  return 0;
}

async function cmdStop(home, flags, out) {
  const info = readServerInfo(home);
  const running = await probe(info);
  if (!running) {
    fs.rmSync(infoFile(home), { force: true });
    out.result({ data: { stopped: false }, brief: "The server is not running." });
    return 0;
  }
  try {
    process.kill(running.pid, "SIGTERM");
  } catch {}
  for (let i = 0; i < 30 && (await probe(running, 300)); i++) await new Promise((r) => setTimeout(r, 100));
  out.result({ data: { stopped: true, pid: running.pid }, brief: `Stopped the server (pid ${running.pid}).` });
  return 0;
}

async function cmdStatus(home, flags, out) {
  const running = await runningServer(home);
  const projects = listProjects(home).map((p) => ({ ...p, artifacts: store.artifactDirs(p.dir).length }));
  out.result({
    data: { running: Boolean(running), server: running, projects },
    items: undefined,
    brief: [
      running ? `Running: ${localUrl(running)} on ${running.host} (pid ${running.pid})` : "Not running. Start it with: designagent-artifacts start",
      ...projects.map((p) => `  ${p.name}  ${p.artifacts} artifact${p.artifacts === 1 ? "" : "s"}  ${p.dir}`),
    ],
  });
  return 0;
}

async function cmdPair(home, flags, out) {
  const running = await runningServer(home);
  const key = serverKey(home);
  if (!running) throw new Error("the server is not running; start it with: designagent-artifacts start --host 0.0.0.0");
  const reachable = running.host === "0.0.0.0" || running.host === "::";
  const urls = reachable ? lanAddresses().map((a) => `http://${a}:${running.port}`) : [`http://${running.host}:${running.port}`];
  const links = urls.map((u) => `designagent://pair?url=${encodeURIComponent(u)}&key=${encodeURIComponent(key)}`);
  out.result({
    data: { urls, key, links, reachableFromLan: reachable },
    brief: [
      ...(reachable ? [] : ["The server listens on loopback only; a phone cannot reach it.", "Restart it with: designagent-artifacts stop && designagent-artifacts start --host 0.0.0.0", ""]),
      "In the Design Agent app: Settings → Connect, then enter:",
      ...urls.map((u) => `  Address: ${u}`),
      `  Key:     ${key}`,
      "",
      "Or open this link on the phone:",
      ...links.map((l) => `  ${l}`),
    ],
  });
  return 0;
}

async function cmdNew(home, flags, out, [type, slug]) {
  if (!type || !slug) throw new UsageError("usage: designagent-artifacts new <artboard|document|html|verify> <slug> [--title TEXT]");
  const dir = registerProject(home, projectDir(flags));
  const content = flags.from ? fs.readFileSync(path.resolve(flags.from), "utf8") : undefined;
  const summary = store.createArtifact(dir, { type, slug, title: flags.title, content });
  const where = path.join(dir, ".designagent", "artifacts", type, slug);
  out.result({ data: { ...summary, path: where }, brief: [`Created ${type}/${slug} (${summary.id})`, `Edit: ${where}`] });
  return 0;
}

async function cmdList(home, flags, out) {
  const dir = projectDir(flags);
  let items = store.listArtifacts(dir).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  if (flags.type) items = items.filter((a) => a.type === flags.type);
  const rows = items.map((a) => ({ ref: `${a.type}/${a.slug}`, id: a.id, title: a.title, updated: a.updatedAt.slice(0, 16).replace("T", " "), pending: a.stats.pending }));
  out.result({
    items: out.format === "table" ? rows : items,
    columns: ["ref", "id", "title", "updated", "pending"],
    brief: rows.length ? rows.map((r) => `${r.ref}  ${r.title}  (${r.updated}${r.pending ? `, ${r.pending} pending` : ""})`) : "No artifacts yet. Create one: designagent-artifacts new document design-notes",
  });
  return 0;
}

async function cmdShow(home, flags, out, [ref]) {
  const dir = projectDir(flags);
  const artifact = store.readArtifact(dir, resolveRef(dir, ref));
  const fb = artifact.feedback;
  const brief = [`${artifact.type}/${artifact.slug}  ${artifact.title}  (${artifact.id})`, artifact.preview];
  if (artifact.type === "artboard") {
    for (const q of artifact.content.questions) brief.push(`${q.id}: ${q.prompt ?? ""} → ${fb.answers[q.id]?.optionIds?.join("+") || "(no pick)"}${fb.answers[q.id]?.note ? ` — ${fb.answers[q.id].note}` : ""}`);
  }
  if (artifact.type === "verify") {
    for (const g of artifact.content.groups) brief.push(`${g.id}: ${g.title ?? ""} → ${fb.verdicts[g.id]?.verdict ?? "pending"}${fb.verdicts[g.id]?.note ? ` — ${fb.verdicts[g.id].note}` : ""}`);
  }
  for (const c of fb.comments.filter((c) => !c.resolved)) brief.push(`comment ${c.id} on ${c.anchor.kind === "artifact" ? "the artifact" : JSON.stringify(c.anchor)}: ${c.body}`);
  out.result({ data: artifact, brief });
  return 0;
}

async function cmdInbox(home, flags, out) {
  const dir = projectDir(flags);
  const items = store.listInbox(dir, { includeAcked: Boolean(flags.all) });
  out.result({
    items,
    columns: ["receipt", "artifact", "kind", "summary"],
    brief: items.length
      ? [...items.map((e) => `${e.receipt}  ${e.artifact}  ${e.summary}`), "", "After acting on them: designagent-artifacts ack <receipt>... (or ack --all)"]
      : "Inbox empty.",
  });
  return 0;
}

async function cmdAck(home, flags, out, receipts) {
  const dir = projectDir(flags);
  const wanted = flags.all ? store.listInbox(dir).map((e) => e.receipt) : receipts;
  if (!wanted.length) throw new UsageError("usage: designagent-artifacts ack <receipt>... | --all");
  const found = store.ackEvents(dir, wanted);
  const missing = wanted.filter((r) => !found.includes(r));
  out.result({ data: { acked: found, missing }, brief: [`Acknowledged ${found.length}.`, ...(missing.length ? [`Not found or already acknowledged: ${missing.join(", ")}`] : [])] });
  return missing.length && !flags.all ? 1 : 0;
}

const COMMANDS = {
  start: cmdStart,
  stop: cmdStop,
  status: cmdStatus,
  pair: cmdPair,
  new: cmdNew,
  list: cmdList,
  show: cmdShow,
  inbox: cmdInbox,
  ack: cmdAck,
};

export async function main(argv, { out = process.stdout, err = process.stderr } = {}) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (error) {
    err.write(`error: ${error.message}\n`);
    return 2;
  }
  const { flags, positional } = parsed;
  if (flags.help || positional[0] === "help") {
    out.write(HELP);
    return 0;
  }
  if (flags.version) {
    out.write(`${VERSION}\n`);
    return 0;
  }
  const home = serverHome();
  fs.mkdirSync(home, { recursive: true });
  const [name, ...rest] = positional;
  try {
    if (name === "serve") {
      await serveForeground(home, flags);
      return new Promise(() => {});
    }
    const command = COMMANDS[name];
    const output = makeOutput(flags, command ? name : "open", out);
    if (command) return await command(home, flags, output, rest);
    return await cmdOpen(home, flags, output, positional);
  } catch (error) {
    const code = error instanceof UsageError ? 2 : 1;
    if (flags.json || flags.format === "json") {
      out.write(`${JSON.stringify({ schema: "designagent.cli/v1", ok: false, command: name ?? "open", error: { code: error.code ?? (code === 2 ? "E_USAGE" : "E_FAILED"), message: error.message } }, null, 2)}\n`);
    } else err.write(`error: ${error.message}\n`);
    return code;
  }
}
