// The demo workbench: a few artifacts held in memory, so the app can be tried (and tested)
// without a computer running designagent-artifacts. It answers exactly as the server does.
import { type ArtifactReply, type Backend, BackendError, type LibraryQuery } from "./backend";
import { parseBlocks, replaceBlock } from "./blocks";
import type { Anchor, Artifact, ArtifactSummary, Feedback, Library } from "./types";

const frame = (body: string, style = "") =>
  `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>` +
  `:root{color-scheme:light dark}body{margin:0;font:16px/1.4 -apple-system,sans-serif}${style}</style></head><body>${body}</body></html>`;

const row = (pad: number, size: number, card = false) =>
  frame(
    [1, 2, 3, 4]
      .map(
        (n) =>
          `<div class="row"><div class="dot"></div><div><b>Design notes ${n}</b><br><small>heeler · ${n * 3} min ago</small></div></div>`,
      )
      .join(""),
    `.row{display:flex;gap:12px;align-items:center;padding:${pad}px 16px;font-size:${size}px;` +
      (card ? "margin:10px;border-radius:14px;box-shadow:0 1px 4px #0003;" : "border-bottom:1px solid #8883;") +
      `}.dot{width:${size * 2}px;height:${size * 2}px;border-radius:30%;background:#0969da}small{opacity:.6}`,
  );

const accent = (color: string) =>
  frame(`<div class="hero"><h1>Library</h1><button>New artboard</button></div>`, `.hero{padding:32px 20px}h1{margin:0 0 16px}button{font:inherit;font-weight:600;border:0;border-radius:12px;padding:12px 18px;color:#fff;background:${color}}`);

const BENCH = frame(
  `<main style="padding:20px">
<h2>Corner radius bench</h2>
<label>Radius <output id="out">12</output><br><input type="range" name="radius" min="0" max="32" value="12" style="width:100%"></label>
<p><label><input type="checkbox" name="shadow"> Shadow</label></p>
<div id="card" style="height:120px;background:#0969da22;border:1px solid #0969da"></div>
</main>
<script>
var state = __STATE__;
var card = document.getElementById("card"), out = document.getElementById("out");
function apply() {
  var r = document.querySelector("[name=radius]"), s = document.querySelector("[name=shadow]");
  card.style.borderRadius = r.value + "px"; out.textContent = r.value;
  card.style.boxShadow = s.checked ? "0 8px 24px #0004" : "none";
}
document.querySelectorAll("[name]").forEach(function (el) {
  var k = el.getAttribute("name");
  if (k in state) { if (el.type === "checkbox") el.checked = !!state[k]; else el.value = state[k]; }
  el.addEventListener("change", function () {
    state[k] = el.type === "checkbox" ? el.checked : Number(el.value);
    if (window.nsh && window.nsh.postMessage) window.nsh.postMessage(JSON.stringify({ type: "state", values: state }));
  });
  el.addEventListener("input", apply);
});
apply();
</script>`,
);

const NOTES = `# Offline mode

The library should open instantly, even when the computer running the agent is asleep.

## Context

Today the app shows a spinner until the server answers. On a train that is **forever**.

## Proposal

- Cache the last library and every artifact the person opened.
- Show cached content at once, with a quiet "Offline" badge.
- Queue comments and verdicts, then send them in order once the server answers.

\`\`\`ts
const cached = await Storage.getItem("library");
\`\`\`

## Open questions

Should queued comments be editable before they are sent?
`;

interface Entry {
  summary: Omit<ArtifactSummary, "updatedAt" | "stats" | "preview">;
  content: any;
  feedback: Feedback;
  updated: number;
  rev: number;
}

const emptyFeedback = (): Feedback => ({ comments: [], answers: {}, verdicts: {}, state: {}, rounds: [] });
const project = { dir: "~/code/heeler", name: "heeler" };

export function createDemoBackend(start = Date.parse("2026-11-06T09:00:00Z")): Backend {
  let clock = start;
  let nextId = 1;
  const tick = () => (clock += 60_000);
  const entries: Entry[] = [
    {
      summary: { id: "DemoArtboard000000001", type: "artboard", slug: "library-row", title: "Library row density", project, createdAt: new Date(start - 7_200_000).toISOString() },
      content: {
        brief: "How should a row in the library look on a phone?",
        questions: [
          {
            id: "q1",
            prompt: "How dense should a library row be?",
            options: [
              { id: "a", title: "Compact", description: "More rows, less air", html: row(8, 14) },
              { id: "b", title: "Comfortable", description: "System list spacing", html: row(14, 16) },
              { id: "c", title: "Cards", description: "Each artifact on its own card", html: row(16, 16, true) },
            ],
          },
          {
            id: "q2",
            prompt: "Which accent?",
            options: [
              { id: "blue", title: "Ink blue", html: accent("#0969da") },
              { id: "green", title: "Moss", html: accent("#1a7f37") },
              { id: "violet", title: "Violet", html: accent("#8250df") },
            ],
          },
        ],
      },
      feedback: emptyFeedback(),
      updated: start - 600_000,
      rev: 1,
    },
    {
      summary: { id: "DemoDocument000000001", type: "document", slug: "offline-mode", title: "Offline mode", project, createdAt: new Date(start - 86_400_000).toISOString() },
      content: { markdown: NOTES },
      feedback: emptyFeedback(),
      updated: start - 3_600_000,
      rev: 1,
    },
    {
      summary: { id: "DemoHtmlPage000000001", type: "html", slug: "radius-bench", title: "Corner radius bench", project, createdAt: new Date(start - 172_800_000).toISOString() },
      content: { title: "Corner radius bench" },
      feedback: emptyFeedback(),
      updated: start - 7_200_000,
      rev: 1,
    },
    {
      summary: { id: "DemoVerify00000000001", type: "verify", slug: "library-screen", title: "Library screen", project: { dir: "~/code/quick-diary", name: "quick-diary" }, createdAt: new Date(start - 259_200_000).toISOString() },
      content: {
        brief: "Built screens next to the approved artboard picks.",
        groups: [
          { id: "g1", title: "Library rows", design: { html: row(14, 16) }, built: { html: row(12, 16) }, notes: "Built with 12pt padding" },
          { id: "g2", title: "Accent", design: { html: accent("#0969da") }, built: { html: accent("#0b5cbf") } },
        ],
      },
      feedback: emptyFeedback(),
      updated: start - 10_800_000,
      rev: 1,
    },
  ];

  const touch = (e: Entry) => {
    e.updated = tick();
    e.rev++;
  };
  const libraryRevision = () => entries.map((e) => `${e.summary.id}:${e.rev}`).join(",");

  function content(e: Entry) {
    switch (e.summary.type) {
      case "document":
        return { type: "document", markdown: e.content.markdown, blocks: parseBlocks(e.content.markdown).map(({ id, kind, text }) => ({ id, kind, text })) };
      case "html":
        return { type: "html", title: e.content.title, html: BENCH.replace("__STATE__", JSON.stringify(e.feedback.state).replace(/</g, "\\u003c")) };
      default:
        return { type: e.summary.type, ...e.content };
    }
  }

  function summarize(e: Entry): ArtifactSummary {
    const verdicts = Object.values(e.feedback.verdicts);
    const c = content(e) as any;
    const preview =
      c.type === "document"
        ? (c.blocks.find((b: any) => b.kind === "paragraph")?.text ?? "")
        : c.type === "artboard"
          ? `${c.questions.length} questions, ${c.questions.reduce((n: number, q: any) => n + q.options.length, 0)} options`
          : c.type === "verify"
            ? `${c.groups.length} groups to verify`
            : c.title;
    return {
      ...e.summary,
      updatedAt: new Date(e.updated).toISOString(),
      preview,
      stats: {
        comments: e.feedback.comments.length,
        pending: 0,
        passed: verdicts.filter((v) => v.verdict === "pass").length,
        rejected: verdicts.filter((v) => v.verdict === "reject").length,
      },
    };
  }

  const full = (e: Entry): ArtifactReply => ({
    artifact: { ...summarize(e), content: content(e), feedback: structuredClone(e.feedback) } as Artifact,
    revision: String(e.rev),
  });

  function find(id: string) {
    const e = entries.find((x) => x.summary.id === id);
    if (!e) throw new BackendError("E_NOT_FOUND", `no artifact ${id}`, 404);
    return e;
  }

  const mutate = (id: string, fn: (e: Entry) => void) => {
    const e = find(id);
    fn(e);
    touch(e);
    return Promise.resolve(full(e));
  };

  return {
    info: async () => ({ name: "designagent-artifacts", version: "demo", protocol: 1 }),

    async library({ q, type, sort = "newest", since }: LibraryQuery): Promise<Library | null> {
      const revision = libraryRevision();
      if (since === revision) return null;
      let items = entries.map(summarize);
      if (type) items = items.filter((i) => i.type === type);
      const needle = (q ?? "").trim().toLowerCase();
      if (needle) items = items.filter((i) => `${i.title} ${i.id} ${i.slug} ${i.project.name}`.toLowerCase().includes(needle));
      items.sort((a, b) => (sort === "name" ? a.title.localeCompare(b.title) : sort === "oldest" ? a.updatedAt.localeCompare(b.updatedAt) : b.updatedAt.localeCompare(a.updatedAt)));
      const counts = new Map<string, number>();
      for (const e of entries) counts.set(e.summary.project.dir, (counts.get(e.summary.project.dir) ?? 0) + 1);
      return { revision, projects: [...counts].map(([dir, count]) => ({ dir, name: dir.split("/").pop() ?? dir, count })), items };
    },

    async artifact(id: string, since?: string) {
      const e = find(id);
      return since === String(e.rev) ? null : full(e);
    },

    comment(id: string, anchor: Anchor, body: string) {
      if (!body.trim()) return Promise.reject(new BackendError("E_INVALID", "body is required", 400));
      return mutate(id, (e) => {
        e.feedback.comments.push({ id: `c_demo${nextId++}`, anchor, body: body.trim(), author: "you", at: new Date(tick()).toISOString(), resolved: false });
      });
    },

    resolveComment: (id, commentId, resolved) =>
      mutate(id, (e) => {
        const c = e.feedback.comments.find((x) => x.id === commentId);
        if (c) c.resolved = resolved;
      }),

    answer: (id, questionId, optionIds, note) =>
      mutate(id, (e) => {
        e.feedback.answers[questionId] = { optionIds, note, at: new Date(clock).toISOString() };
      }),

    submitRound: (id, brief) =>
      mutate(id, (e) => {
        const last = e.feedback.rounds.at(-1);
        const commentIds = e.feedback.comments.filter((c) => !last || c.at > last.at).map((c) => c.id);
        e.feedback.rounds.push({ n: e.feedback.rounds.length + 1, at: new Date(tick()).toISOString(), brief: brief.trim(), commentIds });
      }),

    editBlock(id, blockId, text) {
      const e = find(id);
      const next = replaceBlock(e.content.markdown, blockId, text);
      if (next === null) return Promise.reject(new BackendError("E_ANCHOR", "The document changed; reload it", 409));
      return mutate(id, (x) => {
        x.content.markdown = next;
      });
    },

    verdict(id, groupId, verdict, note) {
      if (verdict === "reject" && !note.trim()) return Promise.reject(new BackendError("E_INVALID", "a rejection needs a note saying what to fix", 400));
      return mutate(id, (e) => {
        e.feedback.verdicts[groupId] = { verdict, note: note.trim(), at: new Date(clock).toISOString() };
      });
    },

    setState: (id, values) =>
      mutate(id, (e) => {
        Object.assign(e.feedback.state, values);
      }),

    webUrl: (path) => `about:blank#${path}`,
  };
}
