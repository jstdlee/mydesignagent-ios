// The app's flows, with the steps a person takes: the demo workbench for artifacts, a stubbed
// companion server for pairing.
import { describe, expect, open, test } from "nsh/test";

const DEMO = { "connection.v1": JSON.stringify({ mode: "demo", url: "", key: "" }) };
const SERVER = "http://10.0.0.5:27419";

const summary = {
  id: "Abc123Abc123Abc123Abc",
  type: "document",
  slug: "design-notes",
  title: "Design notes",
  project: { dir: "/Users/me/code/app", name: "app" },
  createdAt: "2026-11-06T08:00:00.000Z",
  updatedAt: "2026-11-06T08:30:00.000Z",
  preview: "The library opens first.",
  stats: { comments: 0, pending: 0, passed: 0, rejected: 0 },
};

describe("first run", () => {
  test("offers pairing and the demo, and the demo fills the library", async () => {
    const app = await open("./App.tsx");
    await app.waitFor("Review what your agent designs");
    expect(app.shows("id:connect")).toBe(true);
    await app.press("id:try-demo");
    await app.waitFor("Library row density");
    expect(app.shows("Offline mode")).toBe(true);
    expect(app.shows("Corner radius bench")).toBe(true);
    expect(app.shows("Library screen")).toBe(true);
    expect(JSON.parse(app.storage()["connection.v1"]).mode).toBe("demo");
  });

  test("pairs with a server after checking its key", async () => {
    const app = await open("./App.tsx", {
      network: {
        [`GET ${SERVER}/api/v1/info`]: { body: { name: "designagent-artifacts", version: "0.1.0", protocol: 1 } },
        [`GET ${SERVER}/api/v1/library*`]: (request) =>
          request.headers.authorization === "Bearer good-key"
            ? { body: { revision: "r1", projects: [{ dir: "/Users/me/code/app", name: "app", count: 1 }], items: [summary] } }
            : { status: 401, body: { error: { code: "E_AUTH", message: "pair this device" } } },
      },
    });
    await app.press("id:connect");
    await app.waitFor("id:address");
    await app.type("id:address", "10.0.0.5:27419");
    await app.type("id:key", "bad-key");
    await app.press("id:connect-submit");
    await app.waitFor("id:connection-error");
    expect(app.texts().join(" ")).toContain("The key was not accepted");

    await app.clear("id:key");
    await app.type("id:key", "good-key");
    await app.press("id:connect-submit");
    await app.waitFor("Design notes");
    expect(JSON.parse(app.storage()["connection.v1"])).toEqual({ mode: "server", url: SERVER, key: "good-key" });
  });
});

describe("library", () => {
  test("filters by type and searches across projects", async () => {
    const app = await open("./App.tsx", { storage: DEMO });
    await app.waitFor("Library row density");
    await app.press("id:filter-Documents");
    await app.waitFor("Library row density", { state: "gone" });
    expect(app.shows("Offline mode")).toBe(true);
    await app.press("id:filter-All");
    await app.type("id:library-search", "quick-diary");
    await app.waitFor("Offline mode", { state: "gone" });
    expect(app.shows("Library screen")).toBe(true);
  });

  test("the palette jumps to an artifact", async () => {
    const app = await open("./App.tsx", { storage: DEMO });
    await app.waitFor("Library row density");
    await app.press("id:open-palette");
    await app.type("id:palette-input", "radius");
    await app.submit("id:palette-input");
    await app.waitFor("id:live-page");
  });
});

describe("artboard", () => {
  test("picks an option and submits the round", async () => {
    const app = await open("./App.tsx", { storage: DEMO });
    await app.waitFor("Library row density");
    await app.press("Library row density");
    await app.waitFor("id:pick-q1-b");
    await app.press("id:pick-q1-b");
    await app.waitFor("label:Unpick q1 b");
    await app.type("id:round-brief", "Go with comfortable");
    await app.press("id:submit-round");
    await app.waitFor("Round sent to the agent");
    await app.waitFor("Round 2");
  });

  test("a comment on an option shows under its question", async () => {
    const app = await open("./App.tsx", { storage: DEMO });
    await app.waitFor("Library row density");
    await app.press("Library row density");
    await app.waitFor("id:comment-q1-a");
    await app.press("id:comment-q1-a");
    await app.type("id:comment-input", "Too cramped for thumbs");
    await app.press("role:button[Send]");
    await app.waitFor("Too cramped for thumbs");
  });
});

describe("document", () => {
  test("comments on a block and edits another in place", async () => {
    const app = await open("./App.tsx", { storage: DEMO });
    await app.waitFor("Offline mode");
    await app.press("Offline mode");
    await app.waitFor("Should queued comments be editable before they are sent?");
    await app.press("Should queued comments be editable before they are sent?");
    await app.press("id:block-comment");
    await app.type("id:comment-input", "Yes, until they are sent");
    await app.press("role:button[Send]");
    await app.waitFor("Yes, until they are sent");

    await app.press("The library should open instantly, even when the computer running the agent is asleep.");
    await app.press("id:block-edit");
    await app.clear("id:block-input");
    await app.type("id:block-input", "The library opens at once, offline too.");
    await app.press("id:block-save");
    await app.waitFor("The library opens at once, offline too.");
    expect(app.shows("The library should open instantly, even when the computer running the agent is asleep.")).toBe(false);
  });
});

describe("verify", () => {
  test("a rejection needs a note; a pass shows at once", async () => {
    const app = await open("./App.tsx", { storage: DEMO });
    await app.waitFor("Library screen");
    await app.press("Library screen");
    await app.waitFor("id:pass-g1");
    await app.press("id:pass-g1");
    await app.waitFor("Passed");
    await app.press("id:reject-g2");
    expect(app.enabled("id:reject-send")).toBe(false);
    await app.type("id:reject-note", "The accent is darker than approved");
    await app.press("id:reject-send");
    await app.waitFor("Fix: The accent is darker than approved");
  });
});
