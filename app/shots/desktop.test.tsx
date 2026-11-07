// The desktop app's screens with the demo workbench, light and dark.
import { open, test } from "nsh/test";
import { DEMO, shot } from "./shot";

const WINDOW = { platform: "macos", width: 1280, height: 800 } as const;

test("desktop screens", async () => {
  const app = await open("../App.tsx", { ...WINDOW, storage: DEMO });
  await app.waitFor("Library row density");
  await shot(app, "desktop-01-library");

  await app.press("Library row density");
  await app.waitFor("id:pick-q1-b");
  await shot(app, "desktop-02-artboard");

  await app.press("Offline mode");
  await app.waitFor("Should queued comments be editable before they are sent?");
  await shot(app, "desktop-03-document");

  await app.press("Library screen");
  await app.waitFor("id:pass-g1");
  await shot(app, "desktop-04-verify");

  await app.press("Corner radius bench");
  await app.waitFor("id:live-page");
  await shot(app, "desktop-05-live-page");

  await app.keyboard.press("mod+k");
  await app.waitFor("id:palette-input");
  await shot(app, "desktop-06-palette");
});

test("desktop dark and narrow", async () => {
  const app = await open("../App.tsx", { ...WINDOW, storage: DEMO, colorScheme: "dark" });
  await app.waitFor("Offline mode");
  await app.press("Offline mode");
  await app.waitFor("Should queued comments be editable before they are sent?");
  await shot(app, "desktop-07-document-dark");
  await app.setViewport(760, 800);
  await app.waitFor("Should queued comments be editable before they are sent?");
  await shot(app, "desktop-08-narrow");
});

test("desktop first run", async () => {
  const app = await open("../App.tsx", WINDOW);
  await app.waitFor("Review what your agent designs");
  await shot(app, "desktop-09-welcome");
});
