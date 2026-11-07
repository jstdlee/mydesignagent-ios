// The phone app's screens with the demo workbench, light and dark. Real devices are slower
// than headless runs, so each test has two minutes.
import { open, test } from "nsh/test";
import { DEMO, loaded, shot } from "./shot";

const T = 120_000;
const demo = async () => {
  const app = await open("../App.tsx", { storage: DEMO });
  await app.waitFor("Library row density");
  return app;
};

test("library", async () => {
  const app = await demo();
  await shot(app, "phone-01-library");
}, T);

test("artboard", async () => {
  const app = await demo();
  await app.press("Library row density");
  await app.waitFor("id:pick-q1-b");
  await app.press("id:pick-q1-b");
  await loaded(app, "frame-q1-b");
  await shot(app, "phone-02-artboard");
  await app.press("id:comment-mode");
  await shot(app, "phone-03-artboard-comment-mode");
}, T);

test("document", async () => {
  const app = await demo();
  await app.press("Offline mode");
  await app.waitFor("Should queued comments be editable before they are sent?");
  await shot(app, "phone-04-document");
  await app.press("Should queued comments be editable before they are sent?");
  await app.waitFor("id:block-comment");
  await shot(app, "phone-05-document-block-actions");
  await app.press("id:block-comment");
  await app.type("id:comment-input", "Yes, until they are sent");
  await shot(app, "phone-06-comment-composer");
}, T);

test("live page", async () => {
  const app = await demo();
  await app.press("Corner radius bench");
  await loaded(app, "live-page");
  await shot(app, "phone-07-live-page");
}, T);

test("verify", async () => {
  const app = await demo();
  await app.press("Library screen");
  await app.waitFor("id:pass-g1");
  await loaded(app, "built-g1");
  await app.press("id:pass-g1");
  await shot(app, "phone-08-verify");
}, T);

test("palette", async () => {
  const app = await demo();
  await app.keyboard.press("mod+k"); // the header's search is a system bar button on iOS
  await app.waitFor("id:palette-input");
  await shot(app, "phone-09-palette");
}, T);

test("first run, dark", async () => {
  const app = await open("../App.tsx", { colorScheme: "dark" });
  await app.waitFor("Review what your agent designs");
  await shot(app, "phone-10-welcome-dark");
  await app.press("id:connect");
  await app.waitFor("id:address");
  await shot(app, "phone-11-connection-dark");
}, T);
