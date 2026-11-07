// After the app's run: what the person did must be on the agent's side.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const project = process.argv[2];
const cli = path.join(path.dirname(fileURLToPath(import.meta.url)), "../server/bin/designagent-artifacts.js");
const inbox = JSON.parse(execFileSync(process.execPath, [cli, "inbox", "--json", "--project-dir", project], { encoding: "utf8" })).data;
const lines = inbox.map((e) => `${e.artifact} ${e.kind}: ${e.summary}`);
console.log(lines.join("\n"));

const has = (re) => assert.ok(lines.some((l) => re.test(l)), `inbox lacks ${re}`);
has(/artboard\/header-options comment: comment on q1 → a: Too tall for a phone/);
has(/artboard\/header-options round: round 1 submitted: q1 → b — Go with b, keep the icon/);
has(/document\/settings-notes edit: edited block b_/);
has(/verify\/built-header verdict: g1 rejected: Title is 2pt too small/);

const doc = fs.readFileSync(path.join(project, ".designagent/artifacts/document/settings-notes/document.md"), "utf8");
assert.match(doc, /Settings open from the title bar\./);
assert.doesNotMatch(doc, /library header/);
assert.match(doc, /Added by the agent while you were reading\./);
console.log("e2e: the agent's side has everything the person did");
