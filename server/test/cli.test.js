import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Writable } from "node:stream";
import { test } from "node:test";
import { main, parseArgs } from "../src/cli.js";
import * as store from "../src/store.js";

function capture() {
  let text = "";
  const stream = new Writable({
    write(chunk, _enc, done) {
      text += chunk;
      done();
    },
  });
  return { stream, text: () => text };
}

async function run(args) {
  const out = capture();
  const err = capture();
  const code = await main(args, { out: out.stream, err: err.stream });
  return { code, out: out.text(), err: err.text() };
}

process.env.DESIGNAGENT_SERVER_HOME = fs.mkdtempSync(path.join(os.tmpdir(), "da-cli-home-"));
const project = fs.mkdtempSync(path.join(os.tmpdir(), "da-cli-proj-"));
fs.mkdirSync(path.join(project, ".git"));

test("parses flags with inline and separate values", () => {
  assert.deepEqual(parseArgs(["new", "document", "x", "--title=A b", "--json"]), { flags: { title: "A b", json: true }, positional: ["new", "document", "x"] });
  assert.deepEqual(parseArgs(["--project-dir", "/p", "list"]).flags, { "project-dir": "/p" });
  assert.throws(() => parseArgs(["--title"]), /needs a value/);
});

test("new, list, show, inbox and ack through the command line", async () => {
  const made = await run(["new", "document", "design-notes", "--title", "Design notes", "--project-dir", project, "--json"]);
  assert.equal(made.code, 0, made.err);
  const envelope = JSON.parse(made.out);
  assert.equal(envelope.schema, "designagent.cli/v1");
  assert.equal(envelope.data.type, "document");

  const listed = await run(["list", "--project-dir", project, "--format", "jsonl"]);
  const lines = listed.out.trim().split("\n").map((l) => JSON.parse(l));
  assert.deepEqual(lines.map((l) => l.kind), ["meta", "item", "result"]);

  const table = await run(["list", "--project-dir", project, "--format", "table"]);
  assert.match(table.out, /^ref\s+id\s+title/);
  assert.match(table.out, /document\/design-notes/);

  const dir = store.findArtifact(project, "document/design-notes");
  const block = store.readArtifact(project, dir).content.blocks[1];
  store.addComment(project, dir, { anchor: { kind: "block", blockId: block.id }, body: "Say who reads this." });

  const inbox = await run(["inbox", "--project-dir", project]);
  assert.match(inbox.out, /document\/design-notes\s+comment on block b_[0-9a-f]{8}: Say who reads this\./);
  const receipt = inbox.out.match(/r_[A-Za-z0-9]{12}/)[0];

  const shown = await run(["show", "document/design-notes", "--project-dir", project]);
  assert.match(shown.out, /Say who reads this/);

  assert.equal((await run(["ack", receipt, "--project-dir", project])).code, 0);
  assert.match((await run(["inbox", "--project-dir", project])).out, /Inbox empty/);
  const again = await run(["ack", receipt, "--project-dir", project]);
  assert.equal(again.code, 1);
  assert.match(again.out, /already acknowledged/);
});

test("usage errors exit 2; failures exit 1 with a JSON error when asked", async () => {
  assert.equal((await run(["new", "document"])).code, 2);
  assert.equal((await run(["definitely-not-a-dir"])).code, 2);
  const missing = await run(["show", "document/none", "--project-dir", project, "--json"]);
  assert.equal(missing.code, 1);
  assert.equal(JSON.parse(missing.out).ok, false);
  assert.match((await run(["--help"])).out, /designagent-artifacts new <type> <slug>/);
});

test("status reports a stopped server", async () => {
  const status = await run(["status", "--json"]);
  assert.equal(JSON.parse(status.out).data.running, false);
});
