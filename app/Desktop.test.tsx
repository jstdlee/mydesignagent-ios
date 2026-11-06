// The desktop layout: macOS at a desktop window's size, with the demo workbench.
import { describe, expect, open, test } from "nsh/test";

const DEMO = { "connection.v1": JSON.stringify({ mode: "demo", url: "", key: "" }) };
const DESKTOP = { platform: "macos", width: 1280, height: 800, storage: DEMO } as const;

describe("desktop", () => {
  test("the library stays beside the selected artifact", async () => {
    const app = await open("./App.tsx", DESKTOP);
    await app.waitFor("Offline mode");
    expect(app.shows("Select an artifact")).toBe(true);
    await app.press("Offline mode");
    await app.waitFor("Should queued comments be editable before they are sent?");
    expect(app.shows("Library row density")).toBe(true);
    await app.press("Library screen");
    await app.waitFor("id:pass-g1");
    expect(app.shows("Should queued comments be editable before they are sent?")).toBe(false);
  });

  test("the title bar's search and the keyboard open the palette", async () => {
    const app = await open("./App.tsx", DESKTOP);
    await app.waitFor("id:title-bar");
    await app.keyboard.press("mod+k");
    await app.waitFor("id:palette-input");
    await app.type("id:palette-input", "radius");
    await app.submit("id:palette-input");
    await app.waitFor("id:live-page");
    expect(app.shows("id:sidebar")).toBe(true);
  });

  test("a right click on a row offers its context menu", async () => {
    const app = await open("./App.tsx", DESKTOP);
    await app.waitFor("Offline mode");
    await app.rightClick("Offline mode");
    const labels = (app.menu() ?? []).map((item: { label: string }) => item.label);
    expect(labels).toContain("Open");
    expect(labels).toContain("Copy ID");
    await app.chooseMenuItem("Copy ID");
    expect(app.clipboard()).toBe("DemoDocument000000001");
  });

  test("resizing across the split width keeps the open artifact", async () => {
    const app = await open("./App.tsx", { ...DESKTOP, width: 700 });
    await app.waitFor("Offline mode");
    expect(app.shows("id:sidebar")).toBe(false);
    await app.press("Offline mode");
    await app.waitFor("Should queued comments be editable before they are sent?");
    await app.setViewport(1280, 800);
    await app.waitFor("id:sidebar");
    expect(app.shows("Should queued comments be editable before they are sent?")).toBe(true);
  });

  test("before pairing, the connection form opens in the window", async () => {
    const app = await open("./App.tsx", { platform: "macos", width: 1280, height: 800 });
    await app.waitFor("Review what your agent designs");
    await app.press("id:connect");
    await app.waitFor("id:address");
  });
});
