# CLAUDE.md

Support-Inbox-Intelligence — full-stack internship & talent-management platform with a
workspace-scoped ticketing module. React 19 + Vite frontend, Node.js + Express 5 backend,
Socket.IO real-time, MongoDB via Mongoose, Supabase Storage, Groq AI, GitHub App.

This file is the router. It stays short because it loads into every context window.
Detail lives in the referenced docs below — read them when the task calls for it.

## Monorepo map

- `frontend/` — React + Vite SPA. Has its own `CLAUDE.md` (auto-loads when you work there).
- `server/` — Express API + Socket.IO. Has its own `CLAUDE.md`.
- `README.md` — human-facing overview, full feature list, env vars, seeding.

## Read before you act

- **Designing a feature / touching data model, roles, auth, or sockets** → read `.claude/docs/architecture.md`
- **Anything touching tickets, workspaces, rooms, or role guards** → read `.claude/docs/security.md` (authz is scoped per-workspace; get this wrong and you leak cross-tenant data)
- **Staffing requests, putting interns forward, or the close-out cascade** → read `.claude/docs/staffing-requests.md` (architecture.md carries only the summary)
- **Writing code** → follow `.claude/docs/conventions.md`
- **Running, seeding, building, verifying** → `.claude/docs/workflows.md`
- **Reviewing a change** → run the `/code-review` skill (Standards + Spec, in parallel sub-agents)
- **Confirming a change works in the app** → run the `verify` skill (`.claude/skills/verify/`)

## Hard rules

- **Never run a destructive seeder (`seed`, `seed:demo`, `seed:test`) against any non-local DB.**
  `npm run seed` wipes all collections. The additive, idempotent scripts (`seed:recommendations`,
  `seed:technologies`) are fine against the shared dev DB. `seed:staffing-requests` sits between
  the two: destructive, but only to staffing requests and the recommendations they produced —
  see `.claude/docs/workflows.md`.
- **Never commit `.env`, secrets, tokens, or credentials.** Server reads config from `server/.env`.
- **Every ticket / comment / status / room operation must be workspace-scoped.** No cross-workspace reads or writes. See `.claude/docs/security.md`.
- **There is no integration or E2E suite.** Tests are colocated `*.test.js` files, and they only
  ever cover pure functions: helpers on both sides, plus a few `server/services/` modules with
  Mongo and Supabase mocked. No component renders, no route or socket is exercised. Run
  `npm test` to see the current set — never claim a route, query or screen is verified by tests.
  Verify those by driving the app (`/verify`, `/run`).
- Match surrounding code style. Prettier is the formatter; run `npm run format` in the package you changed.
- Backend is CommonJS (`require`), frontend is ESM (`import`). Don't mix.

## Conventions at a glance

- API responses: `{ success, message, data? }`. Controllers wrap handlers in try/catch and map errors to status codes.
- Backend layering: `routes → controllers → services → models` (thin controllers, logic in services). Helpers in `server/helpers/`.
- Frontend data: axios helpers in `src/api/`, React Query hooks in `src/queries/`. Components never call axios directly.

## Keep these docs in sync

These files are only useful while they match the code. When a change alters something they
describe, update the relevant doc **in the same change** — don't leave it for later. If the
right wording is genuinely unclear, make your best edit and flag it in your summary rather
than skipping it. Never let code and docs drift apart silently.

- Data model, roles, auth flow, sockets, or an integration changes → update `.claude/docs/architecture.md`
- Anything about staffing requests changes → update `.claude/docs/staffing-requests.md`. Only touch
  architecture.md's summary of it if one of the four facts it states there stops being true.
- An authz rule, guard, scoping behavior, or secret handling changes → update `.claude/docs/security.md`
- A coding pattern, naming, layering, or the data-layer flow changes → update `.claude/docs/conventions.md`
- A command, env var, seeding, or run/build step changes → update `.claude/docs/workflows.md`
- A rule that only applies to one side changes → update `frontend/CLAUDE.md` or `server/CLAUDE.md`
- **A platform role gains or loses a capability** (what admin/mentor/leadership/intern can each
  see or do) → update the "Roles & Permissions" section of `docs/TEAM_HANDBOOK.md`, in the same
  change. This is a plain-English, team-facing summary — keep entries short bullets, no workflow
  walkthroughs (see the file's own style).

Two rules for writing these docs:

- Reference them by plain (backticked) path, never `@path` — `@` eagerly imports the file into
  every context window and defeats the read-on-demand design.
- **Describe shape, not inventory.** Enumerated file lists go stale silently, because adding a
  file doesn't feel like a change that "alters something the docs describe." Name a directory's
  purpose and its two or three load-bearing files; let `ls` supply the rest.

## Agent skills

### Issue tracker

Issues tracked as local markdown files under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at repo root. See `docs/agents/domain.md`.

### Verify

Launching and driving the app to check a change: `.claude/skills/verify/` (ports, demo logins,
API drive recipe). This repo defines no custom subagents — `.claude/agents/` does not exist, so
review and search run on the built-in agents.
