import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { parseBlocks, replaceBlock } from "../src/blocks.js";
import { findProjectRoot } from "../src/paths.js";
import * as store from "../src/store.js";

const tmpProject = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "da-project-"));
  fs.mkdirSync(path.join(dir, ".git"));
  return dir;
};

test("blocks keep fenced code together and ids survive edits elsewhere", () => {
  const source = "# Title\n\nFirst paragraph\nstill first.\n\n```js\nconst a = 1;\n\nconst b = 2;\n```\n\n- one\n- two\n";
  const blocks = parseBlocks(source);
  assert.deepEqual(blocks.map((b) => b.kind), ["heading", "paragraph", "code", "list"]);
  const edited = replaceBlock(source, blocks[1].id, "A new first paragraph.");
  const after = parseBlocks(edited);
  assert.equal(after[1].text, "A new first paragraph.");
  assert.equal(after[2].id, blocks[2].id, "the code block keeps its id");
  assert.ok(edited.includes("const b = 2;"));
  assert.equal(replaceBlock(source, "b_missing", "x"), null);
});

test("identical blocks get distinct ids", () => {
  const ids = parseBlocks("Same\n\nSame\n").map((b) => b.id);
  assert.equal(new Set(ids).size, 2);
});

test("project root: nearest store, else the git root", () => {
  const dir = tmpProject();
  const nested = path.join(dir, "a", "b");
  fs.mkdirSync(nested, { recursive: true });
  assert.equal(findProjectRoot(nested), dir);
  fs.mkdirSync(path.join(dir, "a", ".designagent", "artifacts"), { recursive: true });
  assert.equal(findProjectRoot(nested), path.join(dir, "a"));
});

test("creates each type with a 21-character id and lists them", () => {
  const dir = tmpProject();
  for (const type of store.ARTIFACT_TYPES) store.createArtifact(dir, { type, slug: `first-${type}`, title: `First ${type}` });
  const items = store.listArtifacts(dir);
  assert.equal(items.length, 4);
  for (const item of items) {
    assert.match(item.id, /^[A-Za-z0-9]{21}$/);
    const idFile = path.join(dir, ".designagent", "artifacts", item.type, item.slug, ".artifact-id");
    assert.equal(fs.readFileSync(idFile, "utf8").trim(), item.id);
  }
  assert.throws(() => store.createArtifact(dir, { type: "document", slug: "first-document" }), /already exists/);
  assert.throws(() => store.createArtifact(dir, { type: "poster", slug: "x" }), /unknown type/);
  assert.throws(() => store.createArtifact(dir, { type: "document", slug: "Bad Slug" }), /slug/);
});

test("artboard: picks, a pixel comment and a submitted round reach the inbox", () => {
  const dir = tmpProject();
  const { id } = store.createArtifact(dir, { type: "artboard", slug: "header" });
  const adir = store.findArtifact(dir, id);
  store.setAnswer(dir, adir, { questionId: "q1", optionIds: ["b"], note: "bolder" });
  assert.throws(() => store.setAnswer(dir, adir, { questionId: "q1", optionIds: ["a", "b"] }), /one option/);
  assert.throws(() => store.setAnswer(dir, adir, { questionId: "q1", optionIds: ["z"] }), /no option/);
  store.addComment(dir, adir, { anchor: { kind: "option", questionId: "q1", optionId: "a", x: 0.25, y: 0.5 }, body: "too tight here" });
  assert.equal(store.listInbox(dir).length, 1, "a comment is an event at once");
  const round = store.submitRound(dir, adir, { brief: "go with b" });
  assert.equal(round.n, 1);
  assert.equal(round.commentIds.length, 1);
  const inbox = store.listInbox(dir);
  assert.deepEqual(inbox.map((e) => e.kind), ["comment", "round"]);
  assert.match(inbox[0].summary, /q1 → a at \(25%, 50%\): too tight here/);
  assert.match(inbox[1].summary, /round 1 submitted: q1 → b — go with b/);
  assert.equal(inbox[1].artifact, "artboard/header");

  assert.deepEqual(store.ackEvents(dir, [inbox[0].receipt, "r_nope"]), [inbox[0].receipt]);
  assert.equal(store.listInbox(dir).length, 1);
  assert.equal(store.listInbox(dir, { includeAcked: true }).length, 2);
  const second = store.submitRound(dir, adir, {});
  assert.equal(second.commentIds.length, 0, "only comments since the last round");
});

test("document: comment on a block, edit in place, stale anchors are refused", () => {
  const dir = tmpProject();
  const { id } = store.createArtifact(dir, { type: "document", slug: "notes", content: "# Notes\n\nKeep this.\n\nChange this.\n" });
  const adir = store.findArtifact(dir, id);
  const blocks = store.readArtifact(dir, adir).content.blocks;
  const target = blocks.find((b) => b.text === "Change this.");
  store.addComment(dir, adir, { anchor: { kind: "block", blockId: target.id }, body: "reword" });
  const content = store.editBlock(dir, adir, { blockId: target.id, text: "Changed by hand." });
  assert.ok(content.blocks.some((b) => b.text === "Changed by hand."));
  assert.equal(fs.readFileSync(path.join(adir, "document.md"), "utf8"), "# Notes\n\nKeep this.\n\nChanged by hand.\n");
  assert.throws(() => store.editBlock(dir, adir, { blockId: target.id, text: "again" }), /document changed/);
  assert.throws(() => store.addComment(dir, adir, { anchor: { kind: "block", blockId: "b_00000000" }, body: "x" }), /no block/);
  assert.throws(() => store.addComment(dir, adir, { body: "  " }), /body is required/);
  const kinds = store.listInbox(dir).map((e) => e.kind);
  assert.deepEqual(kinds, ["comment", "edit"]);
});

test("verify: a rejection needs a note; html state keeps scalar values only", () => {
  const dir = tmpProject();
  const v = store.createArtifact(dir, { type: "verify", slug: "check" });
  const vdir = store.findArtifact(dir, v.id);
  assert.throws(() => store.setVerdict(dir, vdir, { groupId: "g1", verdict: "reject" }), /needs a note/);
  store.setVerdict(dir, vdir, { groupId: "g1", verdict: "reject", note: "spacing is off" });
  assert.equal(store.summarize(dir, vdir).stats.rejected, 1);
  store.setVerdict(dir, vdir, { groupId: "g1", verdict: "pass" });
  assert.equal(store.summarize(dir, vdir).stats.passed, 1);

  const h = store.createArtifact(dir, { type: "html", slug: "bench" });
  const hdir = store.findArtifact(dir, h.id);
  store.setState(dir, hdir, { radius: 20, shadow: true, nested: { no: 1 } });
  assert.deepEqual(store.readArtifact(dir, hdir).feedback.state, { radius: 20, shadow: true });
});

test("artifact files cannot escape their directory or expose feedback", () => {
  const dir = tmpProject();
  const { id } = store.createArtifact(dir, { type: "html", slug: "page" });
  const adir = store.findArtifact(dir, id);
  assert.ok(store.artifactFile(adir, "index.html"));
  assert.equal(store.artifactFile(adir, "../../../../.git"), null);
  assert.equal(store.artifactFile(adir, ".artifact-id"), null);
  store.setState(dir, adir, { a: 1 });
  assert.equal(store.artifactFile(adir, "feedback.json"), null);
});
