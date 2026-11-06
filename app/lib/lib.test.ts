// The app's pure helpers: Markdown blocks, pairing links, addresses and frame messages.
import { expect, test } from "nsh/test";
import { parseFrameMessage } from "../components/WebFrame";
import { normalizeAddress, parsePairingLink, withType } from "./backend";
import { inlineSpans, parseBlocks, replaceBlock } from "./blocks";
import { matchArtifacts } from "../components/CommandPalette";
import { relativeTime } from "./format";

test("blocks keep fenced code whole and ids stable across unrelated edits", () => {
  const source = "# T\n\nOne\n\n```\na\n\nb\n```\n\n- x\n- y\n";
  const blocks = parseBlocks(source);
  expect(blocks.map((b) => b.kind)).toEqual(["heading", "paragraph", "code", "list"]);
  const edited = replaceBlock(source, blocks[1].id, "Two") ?? "";
  expect(parseBlocks(edited)[2].id).toBe(blocks[2].id);
  expect(replaceBlock(source, "b_nope", "x")).toBe(null);
});

test("inline spans", () => {
  expect(inlineSpans("a **b** `c` [d](https://e.dev) *f*")).toEqual([
    { text: "a " },
    { text: "b", bold: true },
    { text: " " },
    { text: "c", code: true },
    { text: " " },
    { text: "d", href: "https://e.dev" },
    { text: " " },
    { text: "f", italic: true },
  ]);
});

test("pairing links and addresses", () => {
  expect(parsePairingLink("designagent://pair?url=http%3A%2F%2F10.0.0.5%3A27419&key=abc")).toEqual({ url: "http://10.0.0.5:27419", key: "abc" });
  expect(parsePairingLink("https://example.com")).toBe(null);
  expect(normalizeAddress(" 10.0.0.5:27419/ ")).toBe("http://10.0.0.5:27419");
  expect(normalizeAddress("https://box.local")).toBe("https://box.local");
});

test("server artifacts get their type on the content", () => {
  const a = withType({ id: "x", type: "html", content: { title: "T" } });
  expect(a.content.type).toBe("html");
});

test("frame messages are clamped and unknown ones dropped", () => {
  expect(parseFrameMessage('{"type":"point","x":1.2,"y":-0.1}')).toEqual({ type: "point", x: 1, y: 0 });
  expect(parseFrameMessage('{"type":"state","values":{"r":2}}')).toEqual({ type: "state", values: { r: 2 } });
  expect(parseFrameMessage("not json")).toBe(null);
});

test("palette matches every word anywhere", () => {
  const item = (title: string, project: string) =>
    ({ id: "i", type: "document", slug: "s", title, project: { dir: "/", name: project }, createdAt: "", updatedAt: "", preview: "", stats: { comments: 0, pending: 0, passed: 0, rejected: 0 } }) as const;
  const items = [item("Offline mode", "heeler"), item("Library row", "quick-diary")];
  expect(matchArtifacts(items, "row quick").map((a) => a.title)).toEqual(["Library row"]);
  expect(matchArtifacts(items, "").length).toBe(2);
});

test("relative time", () => {
  const now = Date.parse("2026-11-06T10:00:00Z");
  expect(relativeTime("2026-11-06T09:59:50Z", now)).toBe("just now");
  expect(relativeTime("2026-11-06T09:30:00Z", now)).toBe("30 min ago");
  expect(relativeTime("2026-11-04T10:00:00Z", now)).toBe("2 d ago");
  expect(relativeTime("2026-10-01T10:00:00Z", now)).toBe("2026-10-01");
});
