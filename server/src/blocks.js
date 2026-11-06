// Splits a Markdown document into blocks with stable ids, so a comment or an edit can name
// "this paragraph" and survive the agent rewriting the rest of the document.
import { shortHash } from "./ids.js";

const FENCE = /^(```|~~~)/;

function kindOf(lines) {
  const first = lines[0].trimStart();
  if (FENCE.test(first)) return "code";
  if (/^#{1,6}\s/.test(first)) return "heading";
  if (/^>/.test(first)) return "quote";
  if (/^\|/.test(first)) return "table";
  if (/^([-*+]|\d+[.)])\s/.test(first)) return "list";
  if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(first)) return "rule";
  return "paragraph";
}

/**
 * Returns blocks `{ id, kind, text, start, end }`; `start`/`end` are line indexes (end exclusive).
 * A fenced code block is one block whatever blank lines it holds.
 */
export function parseBlocks(source) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i].trim() === "") {
      i++;
      continue;
    }
    const start = i;
    if (FENCE.test(lines[i].trimStart())) {
      const fence = lines[i].trimStart().slice(0, 3);
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith(fence)) i++;
      i = Math.min(i + 1, lines.length);
    } else if (/^#{1,6}\s/.test(lines[i].trimStart())) {
      i++; // a heading is a block of its own
    } else {
      while (i < lines.length && lines[i].trim() !== "" && !(i > start && FENCE.test(lines[i].trimStart()))) i++;
    }
    const blockLines = lines.slice(start, i);
    blocks.push({ kind: kindOf(blockLines), text: blockLines.join("\n"), start, end: i });
  }
  const seen = new Map();
  for (const block of blocks) {
    const base = `b_${shortHash(block.text)}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    block.id = n === 1 ? base : `${base}-${n}`;
  }
  return blocks;
}

/** Replaces one block's text, keeping every other line of the source as it was. */
export function replaceBlock(source, blockId, text) {
  const normalized = source.replace(/\r\n/g, "\n");
  const block = parseBlocks(normalized).find((b) => b.id === blockId);
  if (!block) return null;
  const lines = normalized.split("\n");
  const replacement = text.replace(/\r\n/g, "\n").replace(/\n{2,}$/g, "\n").trimEnd();
  lines.splice(block.start, block.end - block.start, ...(replacement ? replacement.split("\n") : []));
  return lines.join("\n");
}
