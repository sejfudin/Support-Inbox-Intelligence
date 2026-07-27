# Workflows

## Prerequisites

- Node.js >= 18, npm.
- MongoDB instance (local or cloud) — `MONGODB_URI`.
- Supabase project + Storage buckets — **required**, server throws on startup without it.
- Optional: Groq API key (AI), GitHub App (PR linking).

Config lives in `server/.env`. Full variable list in `README.md` ("Environment variables").

## Install

```bash
cd server   && npm install
cd frontend && npm install
```

## Run (two terminals)

```bash
# server/
npm run dev        # nodemon index.js  (API + Socket.IO, default :4000)

# frontend/
npm run dev        # Vite dev server, default http://localhost:5173
```

In production, `node index.js` in `server/` also serves the built `frontend/dist` with SPA
fallback — single process hosts API + UI.

## Build

```bash
# frontend/
npm run build      # -> dist/
npm run preview    # serve built assets
```

## Format

```bash
npm run format       # write   (run in the package you changed)
npm run format:check # check
```

## Seeding — DANGEROUS

All three seeders destroy or overwrite data. Never run one against a non-local database
without knowing exactly which one you are pointed at.

```bash
# server/
npm run seed:demo   # RECOMMENDED — coherent demo dataset (see below)
npm run seed        # destructive reset + demo workspace + admin@test.com / mentor@test.com
npm run seed:test   # richer dataset (Symphony staff + interns, password: "password")
npm run seed:positions
npm run backfill:intern-positions
npm run cleanup:invitations
npm run cleanup:stale-recommendations   # close open recommendations of already-placed interns
```

### `npm run seed:demo` — the one to reach for

Wipes transactional data and rebuilds a single coherent dataset: 4 hero logins, 20 interns
(10 active / 5 ready / 2 placed / 2 completed / 1 discontinued) with ~8 weeks of attendance,
two workspaces with a worked-on ticket board, 10 days of stand-ups, and a placement pipeline.
Entry point `server/seeder/seedDemoData.js`; the content lives in `server/seeder/demo/dataset.js`.

**Unlike the other seeders it loads `.env.${NODE_ENV|development}` — the same file `index.js`
reads — so it targets the database `npm run dev` actually uses.** The others load plain `.env`,
which is a _different_ cluster.

- **Wipes**: users, workspaces, ticket statuses, categories, tickets, comments, history,
  notifications, intern profiles, attendance, dailies, recommendations, readiness flags,
  evaluations, mentor comments, integrations, invitations, AI summaries, refresh tokens, and
  non-system projects.
- **Preserves**: hubs, internship types, technologies, positions, and the locked `unspecified`
  project.

```bash
npm run seed:demo -- --dry-run          # print the target + per-collection counts, change nothing
npm run seed:demo                       # interactive: type the DATABASE NAME to confirm
npm run seed:demo -- --yes=<dbname>     # non-interactive; the flag must assert the db name
npm run seed:demo -- --checkin-today    # also check the hero intern in for today
```

The confirmation asks for the database name rather than a fixed word, so a command copy-pasted
from chat fails against the wrong environment. It refuses outright on a db name matching
`/prod|production|_live/`, and it preflight-resolves every reference in the dataset **before**
deleting anything — a typo costs two seconds, not a wiped database.

Deterministic: no `Math.random()`, all dates are working-day offsets from a frozen anchor, and
the `_id` of every user, workspace, profile, ticket, project and attendance row is derived from a
symbolic key. Re-running reproduces the same people, rates, tickets and text, and deep links
survive. (Not bit-identical: the bcrypt salt, mongoose auto-ids on embedded subdocs, and the
per-workspace `TicketStatus` ids from `seedDefaultStatuses()` are regenerated each run.)

**Re-run it on the morning of a demo** — "today" moves with the run, and that is what makes the
roster's current-day column populated and the live check-in possible. The hero intern
(`intern@symphony.is`) is deliberately left un-checked-in so the check-in can be performed live;
that only works inside the 07:00–11:00 Europe/Sarajevo window on a weekday, and the seeder warns
when the window is already shut.

Demo accounts (after seeding): full table in `README.md` ("Demo accounts").

- `admin@`, `mentor@`, `intern@`, `leadership@symphony.is` / `password` (from `seed:demo`).
- `admin@test.com` / `admin123`, `mentor@test.com` / `mentor123` (from `seed`).
- `*@symphony.is` accounts / `password` (from `seed:test`).

## Verifying a change

No test suite exists. To confirm a change works, drive the real app:

- Use `/run` to launch, `/verify` to exercise the affected flow end-to-end.
- Playwright MCP browser tools are permitted for UI verification.
- For API-only changes, hit the endpoint and check the `{ success, message, data }` response
  and the DB state.
