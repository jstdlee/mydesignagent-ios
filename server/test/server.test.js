import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { registerProject, serverKey } from "../src/registry.js";
import { createServer, listen } from "../src/server.js";
import * as store from "../src/store.js";

let server;
let base;
let key;
let project;
const ids = {};

before(async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "da-home-"));
  project = fs.mkdtempSync(path.join(os.tmpdir(), "da-proj-"));
  registerProject(home, project);
  key = serverKey(home);
  ids.doc = store.createArtifact(project, { type: "document", slug: "design-notes", title: "Design notes", content: "# Design notes\n\nThe library opens first.\n" }).id;
  ids.board = store.createArtifact(project, {
    type: "artboard",
    slug: "library-row",
    title: "Library row",
    content: JSON.stringify({
      questions: [{ id: "q1", prompt: "Row density?", options: [{ id: "a", title: "Compact", html: "<p>A</p>" }, { id: "b", title: "Shot", image: "b.png" }] }],
    }),
  }).id;
  fs.writeFileSync(path.join(project, ".designagent/artifacts/artboard/library-row/b.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  ids.page = store.createArtifact(project, { type: "html", slug: "bench", title: "Bench" }).id;
  ids.verify = store.createArtifact(project, { type: "verify", slug: "check", title: "Check" }).id;
  server = createServer({ home, requireKeyOnLoopback: true });
  const port = await listen(server, [0], "127.0.0.1");
  base = `http://127.0.0.1:${port}`;
});

after(() => server.close());

const call = async (method, url, body, auth = true) => {
  const res = await fetch(base + url, {
    method,
    headers: { ...(auth ? { authorization: `Bearer ${key}` } : {}), ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const type = res.headers.get("content-type") ?? "";
  return { status: res.status, headers: res.headers, body: type.includes("json") ? await res.json() : await res.text() };
};

test("info is open; everything else needs the key", async () => {
  assert.equal((await call("GET", "/api/v1/info", null, false)).body.protocol, 1);
  const denied = await call("GET", "/api/v1/library", null, false);
  assert.equal(denied.status, 401);
  assert.equal(denied.body.error.code, "E_AUTH");
});

test("library filters, searches, sorts and short-circuits on an unchanged revision", async () => {
  const all = await call("GET", "/api/v1/library");
  assert.equal(all.status, 200);
  assert.equal(all.body.items.length, 4);
  assert.equal(all.body.projects[0].count, 4);
  const docs = await call("GET", "/api/v1/library?type=document");
  assert.deepEqual(docs.body.items.map((i) => i.title), ["Design notes"]);
  const search = await call("GET", "/api/v1/library?q=ROW");
  assert.deepEqual(search.body.items.map((i) => i.slug), ["library-row"]);
  const byName = await call("GET", "/api/v1/library?sort=name");
  assert.deepEqual(byName.body.items.map((i) => i.title), ["Bench", "Check", "Design notes", "Library row"]);
  const same = await call("GET", `/api/v1/library?since=${all.body.revision}`);
  assert.deepEqual(same.body, { revision: all.body.revision, unchanged: true });
});

test("artboard: links instead of inline html, picks, comments and a round", async () => {
  const { body } = await call("GET", `/api/v1/artifacts/${ids.board}`);
  const [a, b] = body.artifact.content.questions[0].options;
  assert.equal(a.html, undefined);
  assert.equal(a.url, `/a/${ids.board}/option/q1/a`);
  assert.equal(b.imageUrl, `/a/${ids.board}/files/b.png`);

  const picked = await call("PUT", `/api/v1/artifacts/${ids.board}/answers`, { questionId: "q1", optionIds: ["b"] });
  assert.equal(picked.status, 200);
  assert.deepEqual(picked.body.artifact.feedback.answers.q1.optionIds, ["b"]);
  const bad = await call("PUT", `/api/v1/artifacts/${ids.board}/answers`, { questionId: "q9", optionIds: [] });
  assert.equal(bad.status, 409);
  const comment = await call("POST", `/api/v1/artifacts/${ids.board}/comments`, { anchor: { kind: "option", questionId: "q1", optionId: "a", x: 0.1, y: 0.9 }, body: "pin" });
  assert.equal(comment.status, 201);
  assert.equal(comment.body.result.anchor.x, 0.1);
  const round = await call("POST", `/api/v1/artifacts/${ids.board}/rounds`, { brief: "ship b" });
  assert.equal(round.status, 201);
  assert.equal(round.body.artifact.stats.pending, 2);

  const option = await call("GET", `/a/${ids.board}/option/q1/a`);
  assert.match(option.body, /<p>A<\/p>/);
  assert.match(option.body, /window.__DESIGNAGENT__/);
  const image = await fetch(`${base}/a/${ids.board}/files/b.png`, { headers: { authorization: `Bearer ${key}` } });
  assert.equal(image.headers.get("content-type"), "image/png");
  assert.equal((await call("GET", `/a/${ids.board}/files/feedback.json`)).status, 404);
});

test("document: edit a block over the API and see the revision move", async () => {
  const first = await call("GET", `/api/v1/artifacts/${ids.doc}`);
  const block = first.body.artifact.content.blocks.find((b) => b.kind === "paragraph");
  const edited = await call("PUT", `/api/v1/artifacts/${ids.doc}/blocks/${block.id}`, { text: "The library opens first, always." });
  assert.equal(edited.status, 200);
  assert.notEqual(edited.body.revision, first.body.revision);
  const stale = await call("PUT", `/api/v1/artifacts/${ids.doc}/blocks/${block.id}`, { text: "again" });
  assert.equal(stale.status, 409);
  const unchanged = await call("GET", `/api/v1/artifacts/${ids.doc}?since=${edited.body.revision}`);
  assert.equal(unchanged.body.unchanged, true);
});

test("html: the page gets the bridge and keeps control values; ?key sets a cookie", async () => {
  await call("PUT", `/api/v1/artifacts/${ids.page}/state`, { values: { radius: 24 } });
  const res = await fetch(`${base}/a/${ids.page}/page?key=${key}`);
  assert.match(res.headers.get("set-cookie") ?? "", /designagent_key=/);
  const html = await res.text();
  assert.match(html, /"radius":24/);
  assert.match(html, /\/bridge\.js/);
  const cookie = (res.headers.get("set-cookie") ?? "").split(";")[0];
  const withCookie = await fetch(`${base}/api/v1/artifacts/${ids.page}`, { headers: { cookie } });
  assert.equal(withCookie.status, 200);
  const kit = await fetch(`${base}/kit.js`);
  assert.match(await kit.text(), /customElements.define\("da-slider"/);
});

test("verify: verdicts and unknown routes", async () => {
  const pass = await call("PUT", `/api/v1/artifacts/${ids.verify}/verdicts`, { groupId: "g1", verdict: "pass" });
  assert.equal(pass.body.artifact.stats.passed, 1);
  const invalid = await call("PUT", `/api/v1/artifacts/${ids.verify}/verdicts`, { groupId: "g1", verdict: "reject" });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.error.code, "E_INVALID");
  assert.equal((await call("GET", `/api/v1/artifacts/nope`)).status, 404);
  assert.equal((await call("DELETE", `/api/v1/artifacts/${ids.verify}/verdicts`)).status, 404);
  const side = await call("GET", `/a/${ids.verify}/verify/g1/design`);
  assert.match(side.body, /Approved design/);
});
