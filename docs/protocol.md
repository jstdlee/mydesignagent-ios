# Workbench protocol v1

How the Design Agent app, the `designagent-artifacts` server and coding agents share
artifacts. Agents write files; the app talks HTTP; the agent reads the inbox through the CLI.

## On disk

```text
<project>/.designagent/artifacts/<type>/<slug>/
  artifact.json      { schema: "designagent.artifact/v1", id, type, slug, title, createdAt }
  .artifact-id       the same id: 21 letters and digits
  artboard.json | document.md | index.html | verify.json
  <assets>           images and pages the content names
  feedback.json      written by the server only: comments, answers, verdicts, state, rounds, events
```

`<type>` is `artboard`, `document`, `html` or `verify`. A project is the nearest ancestor with
`.designagent/artifacts`, else the enclosing git root.

Machine-wide state lives in `~/.designagent/server/` (`DESIGNAGENT_SERVER_HOME`):
`projects.json`, `key` (mode 0600), `server-info.json`, `server.log`.

## HTTP

The server listens on the first free port of 27419, 27420, 27421
(`DESIGNAGENT_ARTIFACTS_PORTS`), on 127.0.0.1 unless started with `--host`.

Every route except `/api/v1/info`, `/kit.js` and `/bridge.js` needs the key from another
device: `Authorization: Bearer <key>`, or `?key=<key>` on a page (which also sets a
`designagent_key` cookie for the page's own requests). Loopback requests are trusted.

| Method and path | Body | Answer |
|---|---|---|
| `GET /api/v1/info` | | `{ name: "designagent-artifacts", version, protocol: 1 }` |
| `GET /api/v1/library?q&type&sort&since` | | `{ revision, projects, items }`, or `{ revision, unchanged: true }` when `since` is current |
| `GET /api/v1/artifacts/:id?since` | | `{ revision, artifact }` or `{ revision, unchanged: true }` |
| `POST /api/v1/artifacts/:id/comments` | `{ anchor, body }` | 201 `{ result, artifact, revision }` |
| `PATCH /api/v1/artifacts/:id/comments/:commentId` | `{ resolved }` | |
| `PUT /api/v1/artifacts/:id/answers` | `{ questionId, optionIds, note }` | |
| `POST /api/v1/artifacts/:id/rounds` | `{ brief }` | 201 |
| `PUT /api/v1/artifacts/:id/blocks/:blockId` | `{ text }` | 409 when the block no longer exists |
| `PUT /api/v1/artifacts/:id/verdicts` | `{ groupId, verdict: "pass" \| "reject", note }` | a rejection needs a note |
| `PUT /api/v1/artifacts/:id/state` | `{ values }` | scalar control values of a live page |
| `GET /a/:id/page` | | a live page, with the kit and the persistence bridge |
| `GET /a/:id/option/:questionId/:optionId` | | one artboard option as a page |
| `GET /a/:id/verify/:groupId/design\|built` | | one side of a verify group as a page |
| `GET /a/:id/files/<path>` | | a file of the artifact (never `feedback.json` or dotfiles) |

Errors are `{ error: { code, message } }` with `E_AUTH` (401), `E_NOT_FOUND` (404),
`E_INVALID` (400), `E_ANCHOR` (409, the content changed), `E_TOO_LARGE` (413).

Anchors: `{ kind: "artifact" }`, `{ kind: "block", blockId }`,
`{ kind: "option", questionId, optionId, x?, y? }`, `{ kind: "group", groupId, x?, y? }`, where
`x` and `y` are fractions of the page's width and height.

The library's and an artifact's `revision` hash every file's path, modification time and size,
so the app polls every 3 seconds and the server answers `unchanged` cheaply.

## The agent's inbox

Every comment, edit, submitted round and verdict appends an event to the artifact's
`feedback.json` with a receipt. `designagent-artifacts inbox` lists the unacknowledged ones;
`designagent-artifacts ack <receipt>...` marks them handled. Output formats: `brief` (default),
`table`, `json` (envelope `{ schema: "designagent.cli/v1", ok, command, data }`) and `jsonl`
(`meta`, `item`..., `result`). Exit codes: 0 success, 1 failure, 2 usage, 130/143 when a
foreground server is stopped by SIGINT/SIGTERM.
