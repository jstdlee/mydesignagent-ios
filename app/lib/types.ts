// The workbench's data as the app sees it: the companion server's API v1, and the demo.

export type ArtifactType = "artboard" | "document" | "html" | "verify";
export type SortOrder = "newest" | "oldest" | "name";

export interface ArtifactSummary {
  id: string;
  type: ArtifactType;
  slug: string;
  title: string;
  project: { dir: string; name: string };
  createdAt: string;
  updatedAt: string;
  preview: string;
  stats: { comments: number; pending: number; passed: number; rejected: number };
}

export interface Library {
  revision: string;
  projects: { dir: string; name: string; count: number }[];
  items: ArtifactSummary[];
}

/** What a web view shows: a server page (`url`, relative to the server) or inline HTML (the demo). */
export interface WebSource {
  url?: string;
  html?: string;
  imageUrl?: string;
}

export interface ArtboardOption extends WebSource {
  id: string;
  title?: string;
  description?: string;
}

export interface ArtboardQuestion {
  id: string;
  prompt?: string;
  multiple?: boolean;
  options: ArtboardOption[];
}

export interface DocumentBlock {
  id: string;
  kind: "heading" | "paragraph" | "list" | "code" | "quote" | "table" | "rule";
  text: string;
}

export interface VerifyGroup {
  id: string;
  title?: string;
  notes?: string;
  design: WebSource;
  built: WebSource;
}

export type Anchor =
  | { kind: "artifact" }
  | { kind: "block"; blockId: string; quote?: string }
  | { kind: "option"; questionId: string; optionId: string; x?: number; y?: number }
  | { kind: "group"; groupId: string; x?: number; y?: number };

export interface Comment {
  id: string;
  anchor: Anchor;
  body: string;
  author: string;
  at: string;
  resolved: boolean;
}

export interface Feedback {
  comments: Comment[];
  answers: Record<string, { optionIds: string[]; note: string; at: string }>;
  verdicts: Record<string, { verdict: "pass" | "reject"; note: string; at: string }>;
  state: Record<string, string | number | boolean>;
  rounds: { n: number; at: string; brief: string; commentIds: string[] }[];
}

export type ArtifactContent =
  | { type: "artboard"; brief: string; questions: ArtboardQuestion[] }
  | { type: "document"; markdown: string; blocks: DocumentBlock[] }
  | { type: "html"; title: string; pageUrl?: string; html?: string }
  | { type: "verify"; brief: string; groups: VerifyGroup[] };

export interface Artifact extends ArtifactSummary {
  content: ArtifactContent;
  feedback: Feedback;
}

export interface ServerInfo {
  name: string;
  version: string;
  protocol: number;
}

/** Where the app gets artifacts from: the companion server, or the demo built into the app. */
export interface Connection {
  mode: "server" | "demo";
  url: string;
  key: string;
}
