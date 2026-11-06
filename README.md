# Design Agent

Review what your coding agent designs from your iPhone or iPad.

Design Agent has three parts:

- **Agent skills** (`skills/`): a design-first workflow for coding agents - brainstorm, decide
  on artboards, write a spec, build under TDD, debug systematically, verify UI side by side,
  land from a worktree.
- **The artifacts workbench** (`server/`, `npx designagent-artifacts`): a local server that
  serves every project's artboards, documents, live HTML pages and verify rounds, and hands
  the person's answers back to the agent.
- **The app** (`app/`): one [Native Shell](https://nsh.dev) TSX codebase that runs as a native
  iPhone and iPad app (UIKit) and as a desktop app on macOS (AppKit), Windows (Win32) and
  Linux (GTK 4).

## What you can do in the app

| | |
|---|---|
| **Library** | Every artifact of every registered project, newest first. Search by title, project or id; filter by type; sort by newest, oldest or name; pull to refresh; ⌘K palette on a hardware keyboard. Updates live as the agent writes. |
| **Artboard** | Options side by side, drawn live from the agent's HTML. Pick options, add a note per question, pin a comment to any point of a design, and submit the round - the agent reads `q1 → b` with your brief. |
| **Document** | Design docs, reviews and proposals rendered natively from Markdown. Tap a block to comment on it or edit it in place; the agent's edits arrive live, and a block it just rewrote is never overwritten silently. |
| **Live page** | One-page test benches with sliders and switches. Control values persist across the agent's rewrites. A Web Component kit (`/kit.js`) gives agents ready controls. |
| **Verify** | The built UI next to the approved design - side by side on iPad, switchable on iPhone. Pass a group, or reject it with a note; pin comments on the built side. |
| **Demo** | A built-in workbench to try everything without a computer. |
| **Desktop** | On macOS, Windows and Linux: a title bar of the app's own with search and the connection status, the library in a sidebar beside the open artifact, an application menu (File, Edit, View filters ⌘1–⌘5, sort, Go to next/previous artifact ⌥⌘↓/↑, ⌘K, ⌘R, ⌘,), right-click menus on library rows (open, copy id, copy the CLI reference, open in browser), hover states, and the window title following the open artifact. Narrow windows fall back to the phone's navigation stack, keeping what was open. |

## Quick start

On the computer that runs your agent (Node 20+), install the command once from this
repository (it has no dependencies), then start it from your project:

```sh
npm install -g ./server                          # until it is published to npm
designagent-artifacts start --host 0.0.0.0       # one server for every project
designagent-artifacts pair                       # address, key and a designagent://pair link
```

Once published, `npx designagent-artifacts …` does the same without installing.

Then in the app: **Connect to your computer**, paste the pairing link (or type the address and
key), and connect. The phone and computer must be on the same network.

Install the skills in Claude Code:

```text
/plugin marketplace add jstdlee/mydesignagent-ios
/plugin install design-agent@design-agent-dev
```

Then ask for something: "Let's design the settings screen." The agent brainstorms, puts the
choices on an artboard, and waits for your round.

## The command line

```text
designagent-artifacts [project-dir]       Register the project and run the server (Ctrl+C stops it)
designagent-artifacts start | stop | status
designagent-artifacts pair                The address and key the app pairs with
designagent-artifacts new <type> <slug>   artboard | document | html | verify (--title, --from FILE)
designagent-artifacts list | show <ref>   ref: id or type/slug
designagent-artifacts inbox               What the person did, not yet acknowledged
designagent-artifacts ack <receipt>...    After acting on it (--all)
  --format brief|table|json|jsonl, --json, --quiet, --project-dir DIR, --port N, --host HOST
```

The file formats and the HTTP API are in [docs/protocol.md](docs/protocol.md).

## Developing

```sh
# The server: no dependencies
cd server && npm test

# The app: install NSH (https://nsh.dev/docs/installation), then
nsh check app                      # TypeScript, with NSH's generated declarations
nsh test app                       # headless flows: demo workbench and a stubbed server
nsh run app --target ios           # iOS simulator (macOS with Xcode)
nsh run app --target catalyst      # an iPhone-sized window on a Mac
nsh package app --target ios       # an .ipa for devices

# Desktop
nsh run app                        # this machine's desktop backend: AppKit, Win32 or GTK 4
nsh package app --target macos     # a .app (macOS 14+)
nsh package app --target windows   # Windows 10 1809+
nsh package app --target linux     # GTK 4.14+
```

Layout of the app:

```text
app/
  App.tsx            root: phone stack or desktop shell, palette, toast, live sync
  nav.ts             routes
  lib/               types, the Backend seam (HTTP and demo), state, Markdown blocks
  components/        buttons, web frame with pixel pins, comment composer, ⌘K palette
  pages/             Library, Artifact (Artboard, Document, Live page, Verify), Settings,
                     DesktopShell (sidebar + detail pane)
  lib/desktop.ts     window title bar, size and title; the application menu
  *.test.tsx|ts      nsh test
```

## Acknowledgements

The workflow and the workbench follow the ideas of
[Ryugi](https://github.com/Innei/ryugi) by Innei (itself a fork of Superpowers by Jesse
Vincent). Design Agent is an independent implementation: its skills, server and app are
written from scratch and contain no Ryugi code or text, which is under its own source-available
license.

MIT licensed.
