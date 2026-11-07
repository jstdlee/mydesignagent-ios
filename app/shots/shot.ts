// Screenshots for review: on a real platform (`nsh test --target ios|macos|linux`) each one
// is saved under `screenshots/`. Headless runs draw nothing and load no web pages, so there
// both helpers return at once and the tests check the flows alone.
import type { App } from "nsh/test";

export const DEMO = { "connection.v1": JSON.stringify({ mode: "demo", url: "", key: "" }) };

let drawn: boolean | undefined;
/** Whether this run draws the app: only a real platform takes screenshots. */
async function isDrawn(app: App): Promise<boolean> {
  if (drawn === undefined) {
    try {
      await app.screenshot();
      drawn = true;
    } catch {
      drawn = false;
    }
  }
  return drawn;
}

export async function shot(app: App, name: string) {
  if (!(await isDrawn(app))) return;
  await app.wait(600); // let animations settle
  await app.screenshot(`screenshots/${name}.png`);
}

/** Waits for a web frame to load; a frame that fails or hangs fails the test with what it shows. */
export async function loaded(app: App, frameTestID: string) {
  if (!(await isDrawn(app))) return;
  await app.waitFor(`id:${frameTestID}-status`, { state: "gone", timeout: 20_000 });
}
