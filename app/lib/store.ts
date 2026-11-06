// The app's state and the only code that talks to a Backend. Pages read these signals and
// call these functions; they never hold a backend or a request of their own.
import { announce, batch, computed, effect, lifecycle, signal, Storage, untracked } from "nsh";
import { type ArtifactReply, type Backend, BackendError, HttpBackend, normalizeAddress } from "./backend";
import { createDemoBackend } from "./demo";
import type { Anchor, Artifact, ArtifactType, Connection, Library, ServerInfo, SortOrder } from "./types";

const CONNECTION_KEY = "connection.v1";
const POLL_MS = 3000;

// ---------------------------------------------------------------------------------------------
// Connection

const connectionSignal = signal<Connection | null>(null);
const ready = signal(false);
const info = signal<ServerInfo | null>(null);
const offline = signal(false);

/** The current connection, null until paired or the demo is chosen. */
export const connection = () => connectionSignal();
/** Whether the saved connection has been read from the device. */
export const isReady = () => ready();
export const serverInfo = () => info();
/** True while the last request could not reach the server. */
export const isOffline = () => offline();

let demo: Backend | null = null;
const backendSignal = computed<Backend | null>(() => {
  const c = connectionSignal();
  if (!c) return null;
  if (c.mode === "demo") return (demo ??= createDemoBackend());
  return new HttpBackend(c.url, c.key);
});
export const backend = () => backendSignal();

/** Reads the saved connection; called once at start. */
export async function restoreConnection() {
  try {
    const saved = await Storage.getItem(CONNECTION_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Connection;
      if (parsed.mode === "demo" || (parsed.mode === "server" && parsed.url && parsed.key)) connectionSignal.set(parsed);
    }
  } catch {
    // A damaged entry is the same as none: the person pairs again.
  }
  ready.set(true);
}

function save(c: Connection | null) {
  connectionSignal.set(c);
  if (c) Storage.setItem(CONNECTION_KEY, JSON.stringify(c));
  else Storage.removeItem(CONNECTION_KEY);
}

/** Checks the address and key against the server; saves them when both work. */
export async function connect(address: string, key: string): Promise<string | null> {
  const url = normalizeAddress(address);
  if (!url) return "Enter the address designagent-artifacts pair printed.";
  if (!key.trim()) return "Enter the key designagent-artifacts pair printed.";
  const candidate = new HttpBackend(url, key.trim());
  try {
    const answer = await candidate.info();
    await candidate.library({}); // proves the key
    batch(() => {
      info.set(answer);
      offline.set(false);
      resetCaches();
      save({ mode: "server", url, key: key.trim() });
    });
    return null;
  } catch (error) {
    if (error instanceof BackendError && error.status === 401) return "The key was not accepted. Run designagent-artifacts pair again and copy the key.";
    return error instanceof Error ? error.message : String(error);
  }
}

export function useDemo() {
  batch(() => {
    info.set({ name: "designagent-artifacts", version: "demo", protocol: 1 });
    offline.set(false);
    resetCaches();
    save({ mode: "demo", url: "", key: "" });
  });
}

export function disconnect() {
  batch(() => {
    info.set(null);
    resetCaches();
    save(null);
  });
}

// ---------------------------------------------------------------------------------------------
// Messages

const toastSignal = signal<{ id: number; text: string; tone: "info" | "error" } | null>(null);
let toastId = 0;
export const toast = () => toastSignal();

export function showToast(text: string, tone: "info" | "error" = "info") {
  const id = ++toastId;
  toastSignal.set({ id, text, tone });
  announce(text);
  setTimeout(() => {
    if (toastSignal()?.id === id) toastSignal.set(null);
  }, 3500);
}

function report(error: unknown) {
  if (error instanceof BackendError && error.code === "E_OFFLINE") offline.set(true);
  showToast(error instanceof Error ? error.message : String(error), "error");
}

// ---------------------------------------------------------------------------------------------
// Library

const query = signal("");
const typeFilter = signal<ArtifactType | null>(null);
const sort = signal<SortOrder>("newest");
const librarySignal = signal<Library | null>(null);
const loadingLibrary = signal(false);

export const libraryQuery = () => query();
export const libraryType = () => typeFilter();
export const librarySort = () => sort();
export const library = () => librarySignal();
export const isLoadingLibrary = () => loadingLibrary();
export const setLibraryQuery = (q: string) => query.set(q);
export const setLibraryType = (t: ArtifactType | null) => typeFilter.set(t);
export const setLibrarySort = (s: SortOrder) => sort.set(s);

let librarySeq = 0;

/** Fetches the library; `force` skips the unchanged-revision shortcut (a new query, a pull). */
export async function refreshLibrary(force = false) {
  const b = backend();
  if (!b) return;
  const seq = ++librarySeq;
  const current = librarySignal();
  loadingLibrary.set(true);
  try {
    const next = await b.library({ q: query(), type: typeFilter(), sort: sort(), since: force ? undefined : current?.revision });
    if (seq !== librarySeq || b !== backend()) return; // a newer request or another server answered meanwhile
    offline.set(false);
    if (next) librarySignal.set(next);
  } catch (error) {
    if (seq === librarySeq) report(error);
  } finally {
    if (seq === librarySeq) loadingLibrary.set(false);
  }
}

// A new query, filter, sort or server fetches again, typing settling for 200 ms first.
let queryTimer: ReturnType<typeof setTimeout> | undefined;
effect(() => {
  query();
  typeFilter();
  sort();
  backend();
  clearTimeout(queryTimer);
  queryTimer = setTimeout(() => untracked(() => refreshLibrary(true)), 200);
});

// ---------------------------------------------------------------------------------------------
// Artifacts

const artifacts = signal<Record<string, ArtifactReply>>({});
const watched = signal<Record<string, number>>({});

/** The artifact as last fetched (tracked where it is read). */
export const artifactById = (id: string): Artifact | undefined => artifacts()[id]?.artifact;

function resetCaches() {
  artifacts.set({});
  librarySignal.set(null);
}

function remember(reply: ArtifactReply) {
  artifacts.update((all) => ({ ...all, [reply.artifact.id]: reply }));
}

export async function loadArtifact(id: string, force = false) {
  const b = backend();
  if (!b) return;
  try {
    const reply = await b.artifact(id, force ? undefined : artifacts()[id]?.revision);
    offline.set(false);
    if (reply && b === backend()) remember(reply);
  } catch (error) {
    report(error);
  }
}

/** Keeps an artifact fresh while a page shows it; returns the function that stops. */
export function watchArtifact(id: string): () => void {
  watched.update((w) => ({ ...w, [id]: (w[id] ?? 0) + 1 }));
  loadArtifact(id, !artifacts()[id]);
  return () =>
    watched.update((w) => {
      const next = { ...w };
      if ((next[id] ?? 0) <= 1) delete next[id];
      else next[id]--;
      return next;
    });
}

/** Runs a change, keeps the artifact the server answers with, and refreshes the library behind it. */
async function change(run: (b: Backend) => Promise<ArtifactReply>, done?: string): Promise<boolean> {
  const b = backend();
  if (!b) return false;
  try {
    remember(await run(b));
    if (done) showToast(done);
    refreshLibrary();
    return true;
  } catch (error) {
    report(error);
    return false;
  }
}

export const addComment = (id: string, anchor: Anchor, body: string) => change((b) => b.comment(id, anchor, body), "Comment sent to the agent");
export const resolveComment = (id: string, commentId: string, resolved: boolean) => change((b) => b.resolveComment(id, commentId, resolved));
export const pickOptions = (id: string, questionId: string, optionIds: string[], note: string) => change((b) => b.answer(id, questionId, optionIds, note));
export const submitRound = (id: string, brief: string) => change((b) => b.submitRound(id, brief), "Round sent to the agent");
export const editBlock = (id: string, blockId: string, text: string) => change((b) => b.editBlock(id, blockId, text), "Edit saved");
export const setVerdict = (id: string, groupId: string, verdict: "pass" | "reject", note: string) =>
  change((b) => b.verdict(id, groupId, verdict, note), verdict === "pass" ? "Passed" : "Rejected; the agent will fix it");
export const saveState = (id: string, values: Record<string, string | number | boolean>) => change((b) => b.setState(id, values));

/** An absolute URL for a server page, with the key; null in the demo. */
export function webUrl(path: string | undefined): string | null {
  const b = backend();
  if (!b || !path || connectionSignal()?.mode !== "server") return null;
  return b.webUrl(path);
}

// ---------------------------------------------------------------------------------------------
// Live sync: while the app is in front, poll the library and the artifacts on screen. The
// server answers "unchanged" cheaply, so this costs one small request each per interval.

let pollTimer: ReturnType<typeof setInterval> | undefined;
export function startSync() {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    if (lifecycle() !== "active" || !backend()) return;
    refreshLibrary();
    for (const id of Object.keys(watched())) loadArtifact(id);
  }, POLL_MS);
}
