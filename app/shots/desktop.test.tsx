// The desktop app's screens with the demo workbench, light and dark. Real windows are slower
// than headless runs, so each test has two minutes.
import { open, test } from "nsh/test";
import { DEMO, loaded, shot } from "./shot";

const T = 120_000;
const WINDOW = { platform: "macos", width: 1280, height: 800 } as const;
const demo = async (colorScheme: "light" | "dark" = "light") => {
  const app = await open("../App.tsx", { ...WINDOW, storage: DEMO, colorScheme });
  await app.waitFor("Library row density");
  return app;
};
const show = async (app: Awaited<ReturnType<typeof demo>>, title: string, ready: string, name: string, frame?: string) => {
  await app.press(`id:sidebar >> text:${title}`);
  await app.waitFor(ready);
  if (frame) await loaded(app, frame);
  await shot(app, name);
};

test("library", async () => {
  await shot(await demo(), "desktop-01-library");
}, T);

test("artboard", async () => {
  // Opened from the palette: the same flow a person uses with ⌘K.
  const app = await demo();
  await app.keyboard.press("mod+k");
  await app.type("id:palette-input", "density");
  await app.submit("id:palette-input");
  await app.waitFor("id:pick-q1-b");
  await loaded(app, "frame-q1-a");
  await shot(app, "desktop-02-artboard");
}, T);

test("document", async () => {
  await show(await demo(), "Offline mode", "Should queued comments be editable before they are sent?", "desktop-03-document");
}, T);

test("verify", async () => {
  await show(await demo(), "Library screen", "id:pass-g1", "desktop-04-verify", "built-g1");
}, T);

test("live page", async () => {
  await show(await demo(), "Corner radius bench", "id:live-page", "desktop-05-live-page", "live-page");
}, T);

test("palette", async () => {
  const app = await demo();
  await app.keyboard.press("mod+k");
  await app.waitFor("id:palette-input");
  await shot(app, "desktop-06-palette");
}, T);

test("dark and narrow", async () => {
  const app = await demo("dark");
  await show(app, "Offline mode", "Should queued comments be editable before they are sent?", "desktop-07-document-dark");
  await app.setViewport(760, 800);
  await app.waitFor("Should queued comments be editable before they are sent?");
  await shot(app, "desktop-08-narrow");
}, T);

test("first run", async () => {
  const app = await open("../App.tsx", WINDOW);
  await app.waitFor("Review what your agent designs");
  await shot(app, "desktop-09-welcome");
}, T);
