// Screenshots for review: on a real platform (`nsh test --target ios|macos|linux`) each one
// is saved under `screenshots/`; headless runs draw nothing, so there the call is skipped.
import type { App } from "nsh/test";

export const DEMO = { "connection.v1": JSON.stringify({ mode: "demo", url: "", key: "" }) };

export async function shot(app: App, name: string) {
  await app.wait(600); // let web views load and animations settle
  try {
    await app.screenshot(`screenshots/${name}.png`);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== "ERR_NSH_TEST_UNSUPPORTED" && !/real platform|headless/i.test(String(error))) throw error;
  }
}
