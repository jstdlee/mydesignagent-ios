import type { ArtifactType } from "./types";

export const TYPE_LABEL: Record<ArtifactType, string> = {
  artboard: "Artboard",
  document: "Document",
  html: "Live page",
  verify: "Verify",
};

/** SF Symbols for tab-like places that take an icon. */
export const TYPE_SYMBOL: Record<ArtifactType, string> = {
  artboard: "square.grid.2x2",
  document: "doc.text",
  html: "slider.horizontal.3",
  verify: "checkmark.seal",
};

/** The type in a sentence, plural: "artboards", "live pages", "verify rounds". */
export const TYPE_PLURAL: Record<ArtifactType, string> = { artboard: "artboards", document: "documents", html: "live pages", verify: "verify rounds" };

/** A one-letter mark drawn in the type's tile, readable without icons. */
export const TYPE_MARK: Record<ArtifactType, string> = { artboard: "A", document: "D", html: "H", verify: "V" };

export const TYPE_FILTERS: { label: string; type: ArtifactType | null }[] = [
  { label: "All", type: null },
  { label: "Artboards", type: "artboard" },
  { label: "Documents", type: "document" },
  { label: "Live pages", type: "html" },
  { label: "Verify", type: "verify" },
];

/** "just now", "5 min ago", "3 h ago", "2 d ago", else the date. */
export function relativeTime(iso: string, now = Date.now()): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const s = Math.max(0, Math.round((now - then) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} d ago`;
  return iso.slice(0, 10);
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const percent = (v: number | undefined) => (v === undefined ? "" : `${Math.round(v * 100)}%`);
