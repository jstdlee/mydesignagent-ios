// The app's one seam to its data. `HttpBackend` talks to `designagent-artifacts` on the
// person's computer; `DemoBackend` (demo.ts) answers the same calls from memory.
import type { Anchor, Artifact, ArtifactType, Library, ServerInfo, SortOrder } from "./types";

export interface LibraryQuery {
  q?: string;
  type?: ArtifactType | null;
  sort?: SortOrder;
  since?: string;
}

export interface ArtifactReply {
  artifact: Artifact;
  revision: string;
}

export interface Backend {
  info(): Promise<ServerInfo>;
  /** The library, or null when it has not changed since `since`. */
  library(query: LibraryQuery): Promise<Library | null>;
  /** One artifact, or null when it has not changed since `since`. */
  artifact(id: string, since?: string): Promise<ArtifactReply | null>;
  comment(id: string, anchor: Anchor, body: string): Promise<ArtifactReply>;
  resolveComment(id: string, commentId: string, resolved: boolean): Promise<ArtifactReply>;
  answer(id: string, questionId: string, optionIds: string[], note: string): Promise<ArtifactReply>;
  submitRound(id: string, brief: string): Promise<ArtifactReply>;
  editBlock(id: string, blockId: string, text: string): Promise<ArtifactReply>;
  verdict(id: string, groupId: string, verdict: "pass" | "reject", note: string): Promise<ArtifactReply>;
  setState(id: string, values: Record<string, string | number | boolean>): Promise<ArtifactReply>;
  /** An absolute URL a web view can open for a server path, with the pairing key. */
  webUrl(path: string): string;
}

export class BackendError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 0,
  ) {
    super(message);
  }
}

/** "192.168.1.5:27419" → "http://192.168.1.5:27419"; trailing slashes go. */
export function normalizeAddress(input: string): string {
  let url = input.trim();
  if (!url) return "";
  if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
  return url.replace(/\/+$/, "");
}

/** Reads `designagent://pair?url=…&key=…`, as `designagent-artifacts pair` prints it. */
export function parsePairingLink(text: string): { url: string; key: string } | null {
  const match = text.trim().match(/^designagent:\/\/pair\?(.*)$/);
  if (!match) return null;
  const params: Record<string, string> = {};
  for (const part of match[1].split("&")) {
    const i = part.indexOf("=");
    if (i > 0) params[part.slice(0, i)] = decodeURIComponent(part.slice(i + 1));
  }
  return params.url && params.key ? { url: normalizeAddress(params.url), key: params.key } : null;
}

const TIMEOUT_MS = 10_000;

export class HttpBackend implements Backend {
  constructor(
    readonly base: string,
    readonly key: string,
  ) {}

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(this.base + path, {
        method,
        headers: {
          authorization: `Bearer ${this.key}`,
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      throw new BackendError("E_OFFLINE", `Can't reach ${this.base}. Is designagent-artifacts running with --host 0.0.0.0?`);
    } finally {
      clearTimeout(timer);
    }
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      throw new BackendError("E_PROTOCOL", `${this.base} did not answer like designagent-artifacts`, res.status);
    }
    if (!res.ok) {
      const error = data?.error ?? {};
      throw new BackendError(error.code ?? "E_HTTP", error.message ?? `Request failed (${res.status})`, res.status);
    }
    return data as T;
  }

  private reply(data: { artifact: any; revision: string }): ArtifactReply {
    return { artifact: withType(data.artifact), revision: data.revision };
  }

  async info() {
    const info = await this.request<ServerInfo>("GET", "/api/v1/info");
    if (info?.name !== "designagent-artifacts") throw new BackendError("E_PROTOCOL", "That address is not a designagent-artifacts server");
    if (info.protocol < 1) throw new BackendError("E_PROTOCOL", `Server protocol ${info.protocol} is too old; update designagent-artifacts`);
    return info;
  }

  async library({ q, type, sort, since }: LibraryQuery) {
    const params: string[] = [];
    if (q) params.push(`q=${encodeURIComponent(q)}`);
    if (type) params.push(`type=${type}`);
    if (sort) params.push(`sort=${sort}`);
    if (since) params.push(`since=${encodeURIComponent(since)}`);
    const data = await this.request<Library & { unchanged?: boolean }>("GET", `/api/v1/library${params.length ? `?${params.join("&")}` : ""}`);
    return data.unchanged ? null : data;
  }

  async artifact(id: string, since?: string) {
    const data = await this.request<{ artifact: any; revision: string; unchanged?: boolean }>(
      "GET",
      `/api/v1/artifacts/${encodeURIComponent(id)}${since ? `?since=${encodeURIComponent(since)}` : ""}`,
    );
    return data.unchanged ? null : this.reply(data);
  }

  private mutate(method: string, id: string, rest: string, body: unknown) {
    return this.request<{ artifact: any; revision: string }>(method, `/api/v1/artifacts/${encodeURIComponent(id)}/${rest}`, body).then((d) => this.reply(d));
  }

  comment(id: string, anchor: Anchor, body: string) {
    return this.mutate("POST", id, "comments", { anchor, body });
  }
  resolveComment(id: string, commentId: string, resolved: boolean) {
    return this.mutate("PATCH", id, `comments/${encodeURIComponent(commentId)}`, { resolved });
  }
  answer(id: string, questionId: string, optionIds: string[], note: string) {
    return this.mutate("PUT", id, "answers", { questionId, optionIds, note });
  }
  submitRound(id: string, brief: string) {
    return this.mutate("POST", id, "rounds", { brief });
  }
  editBlock(id: string, blockId: string, text: string) {
    return this.mutate("PUT", id, `blocks/${encodeURIComponent(blockId)}`, { text });
  }
  verdict(id: string, groupId: string, verdict: "pass" | "reject", note: string) {
    return this.mutate("PUT", id, "verdicts", { groupId, verdict, note });
  }
  setState(id: string, values: Record<string, string | number | boolean>) {
    return this.mutate("PUT", id, "state", { values });
  }

  webUrl(path: string) {
    const hash = path.indexOf("#");
    const [before, fragment] = hash >= 0 ? [path.slice(0, hash), path.slice(hash)] : [path, ""];
    return `${this.base}${before}${before.includes("?") ? "&" : "?"}key=${encodeURIComponent(this.key)}${fragment}`;
  }
}

/** The server sends `content` without its type; the app's union needs it. */
export function withType(artifact: any): Artifact {
  return { ...artifact, content: { ...artifact.content, type: artifact.type } };
}
