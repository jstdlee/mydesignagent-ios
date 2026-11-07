// End to end: the app against a real designagent-artifacts server that CI started with the
// artifacts e2e/setup.sh made. CI writes config.json (address and key) before the run and
// checks the agent's side (inbox, files on disk) after it with e2e/check.mjs.
import { expect, open, test } from "nsh/test";
import config from "./config.json";

const T = 120_000;
const network = "live" as const;

test("pairs with the real server and lists the project's artifacts", async () => {
  const app = await open("../app/App.tsx", { network });
  await app.press("id:connect");
  await app.type("id:address", config.address);
  await app.type("id:key", config.key);
  await app.press("id:connect-submit");
  await app.waitFor("Header options", { timeout: 15_000 });
  expect(app.shows("Settings notes")).toBe(true);
  expect(JSON.parse(app.storage()["connection.v1"]).url).toBe(config.address);
}, T);

const paired = () =>
  open("../app/App.tsx", {
    network,
    storage: { "connection.v1": JSON.stringify({ mode: "server", url: config.address, key: config.key }) },
  });

test("an artboard round reaches the agent", async () => {
  const app = await paired();
  await app.waitFor("Header options", { timeout: 15_000 });
  await app.press("Header options");
  await app.waitFor("id:pick-q1-b");
  await app.press("id:pick-q1-b");
  await app.waitFor("label:Unpick q1 b");
  await app.press("id:comment-q1-a");
  await app.type("id:comment-input", "Too tall for a phone");
  await app.press("role:button[Send]");
  await app.waitFor("Too tall for a phone");
  await app.type("id:round-brief", "Go with b, keep the icon");
  await app.press("id:submit-round");
  await app.waitFor("Round sent to the agent");
}, T);

test("a document edit is saved, and the agent's own edit arrives live", async () => {
  const app = await paired();
  await app.waitFor("Settings notes", { timeout: 15_000 });
  await app.press("Settings notes");
  await app.waitFor("Settings open from the library header.");
  await app.press("Settings open from the library header.");
  await app.press("id:block-edit");
  await app.clear("id:block-input");
  await app.type("id:block-input", "Settings open from the title bar.");
  await app.press("id:block-save");
  await app.waitFor("Settings open from the title bar.");
  // e2e/setup.sh appends this paragraph to the file a few seconds after the server starts
  // answering; live sync shows it without a reload.
  await app.waitFor("Added by the agent while you were reading.", { timeout: 60_000 });
}, T);

test("a rejected verify group carries its note", async () => {
  const app = await paired();
  await app.waitFor("Built header", { timeout: 15_000 });
  await app.press("Built header");
  await app.waitFor("id:reject-g1");
  await app.press("id:reject-g1");
  await app.type("id:reject-note", "Title is 2pt too small");
  await app.press("id:reject-send");
  await app.waitFor("Fix: Title is 2pt too small");
}, T);
