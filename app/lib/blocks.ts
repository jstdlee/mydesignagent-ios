// Markdown blocks for the demo backend, splitting documents the way the server does:
// fenced code stays one block, headings stand alone, blank lines separate the rest.
import type { DocumentBlock } from "./types";

const FENCE = /^(```|~~~)/;

function kindOf(first: string): DocumentBlock["kind"] {
  const line = first.trimStart();
  if (FENCE.test(line)) return "code";
  if (/^#{1,6}\s/.test(line)) return "heading";
  if (/^>/.test(line)) return "quote";
  if (/^\|/.test(line)) return "table";
  if (/^([-*+]|\d+[.)])\s/.test(line)) return "list";
  if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) return "rule";
  return "paragraph";
}

/** FNV-1a, 32 bits, as hex: a short stable id for a block's text. */
function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

interface Span extends DocumentBlock {
  start: number;
  end: number;
}

export function parseBlocks(source: string): Span[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: Span[] = [];
  const seen = new Map<string, number>();
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
      i++;
    } else {
      while (i < lines.length && lines[i].trim() !== "" && !(i > start && FENCE.test(lines[i].trimStart()))) i++;
    }
    const text = lines.slice(start, i).join("\n");
    const base = `b_${hash(text)}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    blocks.push({ id: n === 1 ? base : `${base}-${n}`, kind: kindOf(lines[start]), text, start, end: i });
  }
  return blocks;
}

export function replaceBlock(source: string, blockId: string, text: string): string | null {
  const normalized = source.replace(/\r\n/g, "\n");
  const block = parseBlocks(normalized).find((b) => b.id === blockId);
  if (!block) return null;
  const lines = normalized.split("\n");
  const replacement = text.replace(/\r\n/g, "\n").trimEnd();
  lines.splice(block.start, block.end - block.start, ...(replacement ? replacement.split("\n") : []));
  return lines.join("\n");
}

export interface InlineSpan {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  href?: string;
}

/** Splits a line into spans for **bold**, *italic*, `code` and [links](url). */
export function inlineSpans(line: string): InlineSpan[] {
  const spans: InlineSpan[] = [];
  const pattern = /(\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|\*([^*]+)\*|_([^_]+)_)/g;
  let last = 0;
  for (let m = pattern.exec(line); m; m = pattern.exec(line)) {
    if (m.index > last) spans.push({ text: line.slice(last, m.index) });
    if (m[2] !== undefined) spans.push({ text: m[2], bold: true });
    else if (m[3] !== undefined) spans.push({ text: m[3], code: true });
    else if (m[4] !== undefined) spans.push({ text: m[4], href: m[5] });
    else spans.push({ text: m[6] ?? m[7], italic: true });
    last = m.index + m[0].length;
  }
  if (last < line.length) spans.push({ text: line.slice(last) });
  return spans.length ? spans : [{ text: "" }];
}
