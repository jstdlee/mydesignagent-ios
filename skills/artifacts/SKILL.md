---
name: artifacts
description: Use when you need to show the person something to look at or decide on - design options, a design document, a live HTML test bench, or built UI to verify - and to read what they said back. Covers creating artboards, documents, live pages and verify rounds with designagent-artifacts, the file formats, and reading the inbox.
---

# Artifacts

The person reviews your work in the **Design Agent** app on their iPhone or iPad (or in a
browser). You write artifacts as files in the project; the app shows them live; what the
person does comes back to you through an inbox.

| Type | Use it for | You write | The person can |
|---|---|---|---|
| `artboard` | Choosing between 2–4 options, side by side | `artboard.json` (options as HTML fragments, `.html` files or images) | Pick, pin comments on any point, add a note, submit the round |
| `document` | Design docs, reviews, proposals, walkthroughs | `document.md` | Comment on a block, edit a block in place |
| `html` | A one-page test bench with live controls | `index.html` | Move sliders and switches; values survive your rewrites |
| `verify` | Built UI next to the approved design | `verify.json` (+ screenshots) | Pass a group, or reject it with a note |

## Start

```sh
npx designagent-artifacts start                 # background server, this project registered
npx designagent-artifacts start --host 0.0.0.0  # when the person reviews on a phone
npx designagent-artifacts pair                  # address + key (+ designagent://pair link) for the app
```

The server is one per machine and serves every registered project. If `status` says it runs on
`127.0.0.1` and the person uses a phone, tell them to restart it with `--host 0.0.0.0`.

## Create

```sh
npx designagent-artifacts new artboard library-row --title "Library row density"
npx designagent-artifacts new document offline-mode --title "Offline mode"
npx designagent-artifacts new html radius-bench --title "Corner radius bench"
npx designagent-artifacts new verify library-screen --title "Library screen"
```

Each lands in `.designagent/artifacts/<type>/<slug>/` with a template. Edit the files directly;
the app picks up every save within a few seconds. Never edit `artifact.json`'s `id` or
`.artifact-id`, and never write `feedback.json` - it is the person's.

### artboard.json

```json
{
  "brief": "How should a library row look on a phone?",
  "questions": [
    {
      "id": "q1",
      "prompt": "How dense should a row be?",
      "multiple": false,
      "options": [
        { "id": "a", "title": "Compact", "description": "More rows, less air", "html": "<div>…</div>" },
        { "id": "b", "title": "Comfortable", "file": "q1-b.html" },
        { "id": "c", "title": "Screenshot", "image": "q1-c.png" }
      ]
    }
  ]
}
```

- `html` is a fragment wrapped in a page that loads the kit (below); `file` is a whole page in
  the artifact directory; `image` is a picture in it.
- Give options short ids (`a`, `b`, `c`) - the person answers "q1 → b".
- Draw each option at phone width (390pt) unless the question is about wider layouts.
- Options must differ in the decision being asked, not in incidental details.

### document.md

Plain Markdown. Blocks are separated by blank lines; a fenced code block is one block. Comments
and edits name a block by a hash of its text, so rewriting one paragraph leaves comments on the
others attached. When the person edits a block, the inbox shows the before and after: fold the
intent into the rest of the document rather than reverting it.

### index.html (live pages)

Any page. Every element with a `name` (inputs, selects, the kit's controls) keeps its value in
the store, and the value is restored when you rewrite the page. Use the kit:

```html
<script type="module" src="/kit.js"></script>
<da-card heading="Radius">
  <da-slider name="radius" label="Corner radius" min="0" max="32" value="12"></da-slider>
  <da-switch name="shadow" label="Shadow"></da-switch>
  <da-input name="label" label="Button label" placeholder="Save"></da-input>
  <da-row><da-button>Primary</da-button><da-button variant="secondary">Secondary</da-button></da-row>
</da-card>
```

Read the current values with `npx designagent-artifacts show html/<slug> --json`
(`data.feedback.state`) before you change the page, and keep their names stable.

### verify.json

```json
{
  "brief": "Built screens next to the approved picks.",
  "groups": [
    { "id": "g1", "title": "Library rows", "design": { "image": "design-g1.png" }, "built": { "image": "built-g1.png" }, "notes": "12pt padding" }
  ]
}
```

A side is `{ "image": "…" }`, `{ "file": "page.html" }` or `{ "html": "<fragment>" }`. See the
`verifying-ui` skill for when and how.

## Read what the person said

```sh
npx designagent-artifacts inbox              # unacknowledged comments, rounds, edits, verdicts
npx designagent-artifacts show artboard/library-row
npx designagent-artifacts ack r_AbC123xyz456 r_…   # after you acted on them
```

- `comment` - on the artifact, a block, an option (with `x`/`y` as fractions of the page when
  pinned to a point), or a verify group.
- `round` - the person submitted an artboard: every pick (`q1 → b`), their brief, and the
  comments since the last round. This is the decision. Do not build before a round arrives.
- `edit` - they rewrote a document block.
- `verdict` - `pass`, or `reject` with what to fix.

Acknowledge an event only after you acted on it, so nothing is lost across a context reset.
Machine-readable output: `--json` (envelope `designagent.cli/v1`) or `--format jsonl`.

## Rules

- Tell the person what to look at and what you need from them, in one sentence each, after you
  create or update an artifact. Do not paste the artifact's content into chat.
- One artifact per decision. Update it for the next round instead of creating `-v2`.
- Waiting for the person is fine. Do not invent their answer.
