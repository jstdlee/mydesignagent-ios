# Design Agent

- `server/`: Node 20+, ES modules, no dependencies. `cd server && npm test` (node:test).
- `app/`: Native Shell (NSH) TSX app. `nsh check app` and `nsh test app`. NSH components run
  once; bindings re-run when the signals they read change. Pages talk to data only through
  `app/lib/store.ts`, which talks only to a `Backend` (`app/lib/backend.ts`, `app/lib/demo.ts`).
- `skills/`: one `SKILL.md` per skill, YAML front matter `name` and `description`.
- The wire format is documented in `docs/protocol.md`; change it, the server, the app's
  `HttpBackend` and the demo together.
