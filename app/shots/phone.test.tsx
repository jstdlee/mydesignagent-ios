// The phone app's screens with the demo workbench, light and dark.
import { expect, open, test } from "nsh/test";
import { DEMO, shot } from "./shot";

test("phone screens", async () => {
  const app = await open("../App.tsx", { storage: DEMO });
  await app.waitFor("Library row density");
  await shot(app, "phone-01-library");

  await app.press("Library row density");
  await app.waitFor("id:pick-q1-b");
  await app.press("id:pick-q1-b");
  await shot(app, "phone-02-artboard");
  await app.press("id:comment-mode");
  await shot(app, "phone-03-artboard-comment-mode");
  await app.back();

  await app.waitFor("Offline mode");
  await app.press("Offline mode");
  await app.waitFor("Should queued comments be editable before they are sent?");
  await shot(app, "phone-04-document");
  await app.press("Should queued comments be editable before they are sent?");
  await app.waitFor("id:block-comment");
  await shot(app, "phone-05-document-block-actions");
  await app.press("id:block-comment");
  await app.type("id:comment-input", "Yes, until they are sent");
  await shot(app, "phone-06-comment-composer");
  await app.press("role:button[Send]");
  await app.waitFor("Yes, until they are sent");
  await app.back();

  await app.waitFor("Corner radius bench");
  await app.press("Corner radius bench");
  await app.waitFor("id:live-page");
  await shot(app, "phone-07-live-page");
  await app.back();

  await app.waitFor("Library screen");
  await app.press("Library screen");
  await app.waitFor("id:pass-g1");
  await app.press("id:pass-g1");
  await shot(app, "phone-08-verify");
  await app.back();

  await app.waitFor("id:open-palette");
  await app.press("id:open-palette");
  await app.waitFor("id:palette-input");
  await shot(app, "phone-09-palette");
  expect(app.shows("id:palette-input")).toBe(true);
});

test("phone first run and dark mode", async () => {
  const app = await open("../App.tsx", { colorScheme: "dark" });
  await app.waitFor("Review what your agent designs");
  await shot(app, "phone-10-welcome-dark");
  await app.press("id:connect");
  await app.waitFor("id:address");
  await shot(app, "phone-11-connection-dark");
});
