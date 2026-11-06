---
name: verifying-ui
description: Use when UI changed and before calling the work done. Puts screenshots of what was built next to the design the person approved, in a verify artifact, and loops on rejections until every group passes.
---

# Verifying UI

The person approved a design; they should approve what you built against it, side by side.

## 1. Capture

For each screen or component that changed, take screenshots of the built UI at the size the
design was drawn (390pt wide for phone artboards), in the same state and with the same content.
Capture dark mode if the design covered it. Use the project's own tooling: a simulator
screenshot, Playwright, `nsh test` with `app.screenshot()`, or the platform's UI tests.

## 2. Pair with the design

Group by what the person will judge together. For each group, the `design` side is the picked
artboard option (copy its HTML into a `file`, or screenshot it) and the `built` side is your
screenshot:

```sh
npx designagent-artifacts new verify <feature>-verify --title "<Feature>: built vs design"
```

```json
{
  "brief": "Rows and accent from round 2 of library-row.",
  "groups": [
    { "id": "g1", "title": "Library rows", "design": { "file": "design-g1.html" }, "built": { "image": "built-g1.png" }, "notes": "Comfortable density (q1 → b)" }
  ]
}
```

Before sending it, look at each pair yourself. Fix differences you can see; do not make the
person find them.

## 3. Ask, then loop

Tell the person the verify artifact is ready. Then read the inbox:

- `verdict … passed` - done for that group.
- `verdict … rejected: <note>` - fix exactly that, re-capture, replace the `built` image, and
  say which groups changed. Acknowledge the event once fixed.
- Pinned comments on the built side carry `x`/`y`: look there.

The UI is done when every group passed. Report it with the verify artifact's name as the
evidence.
