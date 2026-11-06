// The artifact store of one project: `.designagent/artifacts/<type>/<slug>/`.
//
// Every artifact directory holds `artifact.json` (identity and title), `.artifact-id`, the
// type's content (document.md, artboard.json, index.html, verify.json) and `feedback.json`:
// what the person did in the app (comments, picks, verdicts, control values) plus the
// events an agent reads with `designagent-artifacts inbox` and acknowledges with `ack`.
import fs from "node:fs";
import path from "node:path";
import { parseBlocks, replaceBlock } from "./blocks.js";
import { commentId, randomId, receiptId } from "./ids.js";
import { artifactsRoot, readJson, writeFileAtomic, writeJson } from "./paths.js";

export const ARTIFACT_TYPES = ["artboard", "document", "html", "verify"];
export const VERDICTS = ["pass", "reject"];
const CONTENT_FILE = {
  artboard: "artboard.json",
  document: "document.md",
  html: "index.html",
  verify: "verify.json",
};
const MAX_COMMENT = 4000;

export class StoreError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const now = () => new Date().toISOString();
const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;

// ---------------------------------------------------------------------------------------------
// Creating and listing

const TEMPLATES = {
  document: (title) => `# ${title}\n\nWhat this document decides, in one paragraph.\n\n## Context\n\nWhy now.\n\n## Proposal\n\n- First point\n- Second point\n\n## Open questions\n\nWhat still needs an answer.\n`,
  artboard: (title) =>
    `${JSON.stringify(
      {
        brief: title,
        questions: [
          {
            id: "q1",
            prompt: "Which direction should we take?",
            options: [
              { id: "a", title: "Option A", description: "", html: "<div class=\"frame\"><h1>Option A</h1></div>" },
              { id: "b", title: "Option B", description: "", html: "<div class=\"frame\"><h1>Option B</h1></div>" },
            ],
          },
        ],
      },
      null,
      2,
    )}\n`,
  html: (title) =>
    `<!doctype html>\n<html>\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${escapeHtml(title)}</title>\n<script type="module" src="/kit.js"></script>\n</head>\n<body>\n<da-card heading="${escapeHtml(title)}">\n  <da-slider name="radius" label="Corner radius" min="0" max="32" value="12"></da-slider>\n  <da-switch name="shadow" label="Shadow"></da-switch>\n</da-card>\n</body>\n</html>\n`,
  verify: (title) =>
    `${JSON.stringify(
      {
        brief: title,
        groups: [{ id: "g1", title: "First screen", design: { html: "<h1>Approved design</h1>" }, built: { html: "<h1>Built</h1>" }, notes: "" }],
      },
      null,
      2,
    )}\n`,
};

export function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

/** Creates an artifact from its type's template, or from `content` when given. */
export function createArtifact(projectDir, { type, slug, title, content }) {
  if (!ARTIFACT_TYPES.includes(type)) throw new StoreError("E_TYPE", `unknown type "${type}" (${ARTIFACT_TYPES.join(", ")})`);
  if (!SLUG.test(slug ?? "")) throw new StoreError("E_SLUG", `slug must be lowercase letters, digits and dashes: "${slug}"`);
  const dir = path.join(artifactsRoot(projectDir), type, slug);
  if (fs.existsSync(path.join(dir, "artifact.json"))) throw new StoreError("E_EXISTS", `${type}/${slug} already exists`, 409);
  const id = randomId();
  const at = now();
  const name = title?.trim() || slug;
  writeJson(path.join(dir, "artifact.json"), { schema: "designagent.artifact/v1", id, type, slug, title: name, createdAt: at });
  writeFileAtomic(path.join(dir, ".artifact-id"), `${id}\n`);
  writeFileAtomic(path.join(dir, CONTENT_FILE[type]), content ?? TEMPLATES[type](name));
  return summarize(projectDir, dir);
}

/** Every artifact directory of a project. */
export function artifactDirs(projectDir) {
  const root = artifactsRoot(projectDir);
  const dirs = [];
  for (const type of ARTIFACT_TYPES) {
    let entries = [];
    try {
      entries = fs.readdirSync(path.join(root, type), { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const dir = path.join(root, type, entry.name);
      if (entry.isDirectory() && fs.existsSync(path.join(dir, "artifact.json"))) dirs.push(dir);
    }
  }
  return dirs;
}

export function listArtifacts(projectDir) {
  const out = [];
  for (const dir of artifactDirs(projectDir)) {
    try {
      out.push(summarize(projectDir, dir));
    } catch (error) {
      out.push({ broken: true, dir, error: error.message });
    }
  }
  return out.filter((a) => !a.broken);
}

/** Files in an artifact directory with their modification times, for change detection. */
export function fileStamps(dir) {
  const stamps = [];
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (!entry.name.endsWith(".tmp")) {
        const st = fs.statSync(p);
        stamps.push([path.relative(dir, p), st.mtimeMs, st.size]);
      }
    }
  };
  walk(dir);
  return stamps.sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

function readMeta(dir) {
  const meta = readJson(path.join(dir, "artifact.json"), null);
  if (!meta?.id || !ARTIFACT_TYPES.includes(meta.type)) throw new Error(`${dir}: artifact.json lacks an id or type`);
  return meta;
}

function readFeedback(dir) {
  const fb = readJson(path.join(dir, "feedback.json"), {});
  return {
    schema: "designagent.feedback/v1",
    comments: fb.comments ?? [],
    answers: fb.answers ?? {},
    verdicts: fb.verdicts ?? {},
    state: fb.state ?? {},
    rounds: fb.rounds ?? [],
    events: fb.events ?? [],
  };
}

function readContent(type, dir) {
  const file = path.join(dir, CONTENT_FILE[type]);
  const raw = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  switch (type) {
    case "document":
      return { markdown: raw, blocks: parseBlocks(raw).map(({ id, kind, text }) => ({ id, kind, text })) };
    case "artboard": {
      const data = raw ? JSON.parse(raw) : {};
      return { brief: data.brief ?? "", questions: Array.isArray(data.questions) ? data.questions : [] };
    }
    case "verify": {
      const data = raw ? JSON.parse(raw) : {};
      return { brief: data.brief ?? "", groups: Array.isArray(data.groups) ? data.groups : [] };
    }
    case "html":
      return { title: raw.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim() ?? "", html: raw };
  }
}

function previewOf(type, content) {
  switch (type) {
    case "document": {
      const para = content.blocks.find((b) => b.kind === "paragraph");
      return (para?.text ?? "").replace(/\s+/g, " ").slice(0, 160);
    }
    case "artboard": {
      const options = content.questions.reduce((n, q) => n + (q.options?.length ?? 0), 0);
      return `${content.questions.length} question${content.questions.length === 1 ? "" : "s"}, ${options} option${options === 1 ? "" : "s"}`;
    }
    case "verify":
      return `${content.groups.length} group${content.groups.length === 1 ? "" : "s"} to verify`;
    case "html":
      return content.title || "Live page";
  }
}

export function summarize(projectDir, dir) {
  const meta = readMeta(dir);
  const content = readContent(meta.type, dir);
  const feedback = readFeedback(dir);
  const stamps = fileStamps(dir);
  const updatedMs = Math.max(...stamps.map((s) => s[1]), Date.parse(meta.createdAt) || 0);
  const verdicts = Object.values(feedback.verdicts);
  return {
    id: meta.id,
    type: meta.type,
    slug: meta.slug ?? path.basename(dir),
    title: meta.title ?? path.basename(dir),
    project: { dir: projectDir, name: path.basename(projectDir) },
    createdAt: meta.createdAt,
    updatedAt: new Date(updatedMs).toISOString(),
    preview: previewOf(meta.type, content),
    stats: {
      comments: feedback.comments.length,
      pending: feedback.events.filter((e) => !e.ackedAt).length,
      passed: verdicts.filter((v) => v.verdict === "pass").length,
      rejected: verdicts.filter((v) => v.verdict === "reject").length,
    },
  };
}

/** The whole artifact: its summary, content and feedback (without the agent's event log). */
export function readArtifact(projectDir, dir) {
  const summary = summarize(projectDir, dir);
  const { events, ...feedback } = readFeedback(dir);
  return { ...summary, content: readContent(summary.type, dir), feedback };
}

// ---------------------------------------------------------------------------------------------
// What the person does in the app

function update(dir, fn) {
  const feedback = readFeedback(dir);
  const result = fn(feedback);
  writeJson(path.join(dir, "feedback.json"), feedback);
  return result;
}

function pushEvent(feedback, kind, summary, data) {
  const event = { receipt: receiptId(), kind, at: now(), summary, data, ackedAt: null };
  feedback.events.push(event);
  return event;
}

function checkText(value, field, max = MAX_COMMENT) {
  if (typeof value !== "string" || !value.trim()) throw new StoreError("E_INVALID", `${field} is required`);
  if (value.length > max) throw new StoreError("E_INVALID", `${field} is longer than ${max} characters`);
  return value.trim();
}

const fraction = (v) => (typeof v === "number" && v >= 0 && v <= 1 ? Math.round(v * 10000) / 10000 : undefined);

function checkAnchor(type, content, anchor) {
  const a = anchor ?? { kind: "artifact" };
  switch (a.kind) {
    case "artifact":
      return { kind: "artifact" };
    case "block": {
      if (type !== "document") break;
      const block = content.blocks.find((b) => b.id === a.blockId);
      if (!block) throw new StoreError("E_ANCHOR", `no block ${a.blockId}; the document changed, reload it`, 409);
      return { kind: "block", blockId: block.id, quote: (a.quote ?? block.text).slice(0, 280) };
    }
    case "option": {
      if (type !== "artboard") break;
      const q = content.questions.find((q) => q.id === a.questionId);
      if (!q?.options?.some((o) => o.id === a.optionId)) throw new StoreError("E_ANCHOR", `no option ${a.questionId}/${a.optionId}`, 409);
      return { kind: "option", questionId: a.questionId, optionId: a.optionId, x: fraction(a.x), y: fraction(a.y) };
    }
    case "group": {
      if (type !== "verify") break;
      if (!content.groups.some((g) => g.id === a.groupId)) throw new StoreError("E_ANCHOR", `no group ${a.groupId}`, 409);
      return { kind: "group", groupId: a.groupId, x: fraction(a.x), y: fraction(a.y) };
    }
  }
  throw new StoreError("E_ANCHOR", `anchor "${a.kind}" does not fit a ${type}`);
}

function describeAnchor(a) {
  switch (a.kind) {
    case "block":
      return `block ${a.blockId}`;
    case "option":
      return `${a.questionId} → ${a.optionId}${a.x !== undefined ? ` at (${Math.round(a.x * 100)}%, ${Math.round(a.y * 100)}%)` : ""}`;
    case "group":
      return `group ${a.groupId}`;
    default:
      return "the artifact";
  }
}

export function addComment(projectDir, dir, { anchor, body, author = "you" }) {
  const { type } = readMeta(dir);
  const content = readContent(type, dir);
  const text = checkText(body, "body");
  const where = checkAnchor(type, content, anchor);
  return update(dir, (fb) => {
    const comment = { id: commentId(), anchor: where, body: text, author, at: now(), resolved: false };
    fb.comments.push(comment);
    pushEvent(fb, "comment", `comment on ${describeAnchor(where)}: ${text}`, { commentId: comment.id, anchor: where, body: text });
    return comment;
  });
}

export function resolveComment(projectDir, dir, { commentId: id, resolved = true }) {
  return update(dir, (fb) => {
    const comment = fb.comments.find((c) => c.id === id);
    if (!comment) throw new StoreError("E_NOT_FOUND", `no comment ${id}`, 404);
    comment.resolved = Boolean(resolved);
    return comment;
  });
}

/** Picks options for one artboard question; no event until the round is submitted. */
export function setAnswer(projectDir, dir, { questionId, optionIds, note }) {
  const { type } = readMeta(dir);
  if (type !== "artboard") throw new StoreError("E_TYPE", "answers belong to artboards");
  const question = readContent(type, dir).questions.find((q) => q.id === questionId);
  if (!question) throw new StoreError("E_ANCHOR", `no question ${questionId}`, 409);
  const ids = Array.isArray(optionIds) ? [...new Set(optionIds)] : [];
  for (const id of ids) {
    if (!question.options?.some((o) => o.id === id)) throw new StoreError("E_ANCHOR", `no option ${questionId}/${id}`, 409);
  }
  if (!question.multiple && ids.length > 1) throw new StoreError("E_INVALID", `${questionId} takes one option`);
  return update(dir, (fb) => {
    fb.answers[questionId] = { optionIds: ids, note: typeof note === "string" ? note.trim().slice(0, MAX_COMMENT) : "", at: now() };
    return fb.answers[questionId];
  });
}

/** Sends the round to the agent: every pick, the comments since the last round, and a brief. */
export function submitRound(projectDir, dir, { brief } = {}) {
  const { type } = readMeta(dir);
  const content = readContent(type, dir);
  return update(dir, (fb) => {
    const last = fb.rounds.at(-1);
    const since = last ? Date.parse(last.at) : 0;
    const commentIds = fb.comments.filter((c) => Date.parse(c.at) > since).map((c) => c.id);
    const answers = structuredClone(fb.answers);
    const round = { n: fb.rounds.length + 1, at: now(), brief: typeof brief === "string" ? brief.trim().slice(0, MAX_COMMENT) : "", answers, commentIds };
    fb.rounds.push(round);
    const picks =
      type === "artboard"
        ? content.questions.map((q) => `${q.id} → ${answers[q.id]?.optionIds?.join("+") || "(none)"}`).join(", ")
        : "";
    pushEvent(fb, "round", `round ${round.n} submitted${picks ? `: ${picks}` : ""}${round.brief ? ` — ${round.brief}` : ""}`, round);
    return round;
  });
}

/** Rewrites one block of a document in place, as the person typed it. */
export function editBlock(projectDir, dir, { blockId, text }) {
  const { type } = readMeta(dir);
  if (type !== "document") throw new StoreError("E_TYPE", "only documents are edited by block");
  if (typeof text !== "string") throw new StoreError("E_INVALID", "text is required");
  const file = path.join(dir, CONTENT_FILE.document);
  const before = fs.readFileSync(file, "utf8");
  const old = parseBlocks(before).find((b) => b.id === blockId);
  const after = replaceBlock(before, blockId, text);
  if (after === null || !old) throw new StoreError("E_ANCHOR", `no block ${blockId}; the document changed, reload it`, 409);
  writeFileAtomic(file, after);
  update(dir, (fb) => {
    pushEvent(fb, "edit", `edited block ${blockId}`, { blockId, before: old.text, after: text.trim() });
  });
  return readContent("document", dir);
}

export function setVerdict(projectDir, dir, { groupId, verdict, note }) {
  const { type } = readMeta(dir);
  if (type !== "verify") throw new StoreError("E_TYPE", "verdicts belong to verify artifacts");
  if (!readContent(type, dir).groups.some((g) => g.id === groupId)) throw new StoreError("E_ANCHOR", `no group ${groupId}`, 409);
  if (!VERDICTS.includes(verdict)) throw new StoreError("E_INVALID", `verdict is pass or reject`);
  const text = typeof note === "string" ? note.trim().slice(0, MAX_COMMENT) : "";
  if (verdict === "reject" && !text) throw new StoreError("E_INVALID", "a rejection needs a note saying what to fix");
  return update(dir, (fb) => {
    fb.verdicts[groupId] = { verdict, note: text, at: now() };
    pushEvent(fb, "verdict", `${groupId} ${verdict === "pass" ? "passed" : `rejected: ${text}`}`, { groupId, verdict, note: text });
    return fb.verdicts[groupId];
  });
}

/** Saves the controls of a live HTML page, so values outlive the agent rewriting the page. */
export function setState(projectDir, dir, values) {
  if (!values || typeof values !== "object" || Array.isArray(values)) throw new StoreError("E_INVALID", "state is an object of control values");
  const clean = {};
  for (const [key, value] of Object.entries(values).slice(0, 200)) {
    if (["string", "number", "boolean"].includes(typeof value) && key.length <= 100) clean[key] = typeof value === "string" ? value.slice(0, 2000) : value;
  }
  return update(dir, (fb) => {
    Object.assign(fb.state, clean);
    return fb.state;
  });
}

// ---------------------------------------------------------------------------------------------
// The agent's side

export function listInbox(projectDir, { includeAcked = false } = {}) {
  const items = [];
  for (const dir of artifactDirs(projectDir)) {
    const meta = readMeta(dir);
    for (const event of readFeedback(dir).events) {
      if (includeAcked || !event.ackedAt) items.push({ artifact: `${meta.type}/${meta.slug ?? path.basename(dir)}`, artifactId: meta.id, ...event });
    }
  }
  return items.sort((a, b) => (a.at < b.at ? -1 : 1));
}

/** Acknowledges events by receipt; returns the receipts that were found. */
export function ackEvents(projectDir, receipts) {
  const wanted = new Set(receipts);
  const found = [];
  for (const dir of artifactDirs(projectDir)) {
    const fb = readFeedback(dir);
    let changed = false;
    for (const event of fb.events) {
      if (wanted.has(event.receipt) && !event.ackedAt) {
        event.ackedAt = now();
        found.push(event.receipt);
        changed = true;
      }
    }
    if (changed) writeJson(path.join(dir, "feedback.json"), fb);
  }
  return found;
}

/** Finds an artifact directory by id or by "type/slug". */
export function findArtifact(projectDir, ref) {
  for (const dir of artifactDirs(projectDir)) {
    const meta = readMeta(dir);
    if (meta.id === ref || `${meta.type}/${meta.slug ?? path.basename(dir)}` === ref) return dir;
  }
  return null;
}

/** Resolves a file inside an artifact directory, refusing paths that leave it. */
export function artifactFile(dir, relative) {
  const target = path.resolve(dir, relative);
  if (!target.startsWith(path.resolve(dir) + path.sep)) return null;
  const base = path.basename(target);
  if (base === "feedback.json" || base.startsWith(".")) return null;
  return fs.existsSync(target) && fs.statSync(target).isFile() ? target : null;
}
