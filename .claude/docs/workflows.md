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

The three dataset seeders (`seed:demo`, `seed`, `seed:test`) destroy or overwrite data. Never
run one against a non-local database without knowing exactly which one you are pointed at.
The reference-data scripts (`seed:positions`, `seed:technologies`) only upsert missing catalog
rows with `$setOnInsert` and are safe to run anywhere.

```bash
# server/
npm run seed:demo   # RECOMMENDED — coherent demo dataset (see below)
npm run seed        # destructive reset + demo workspace + admin@test.com / mentor@test.com
npm run seed:test   # richer dataset (Symphony staff + interns, password: "password")
npm run seed:positions
npm run seed:technologies               # NON-destructive: adds missing technologies, see below
npm run backfill:intern-positions
npm run cleanup:invitations
npm run cleanup:stale-recommendations   # close open recommendations of already-placed interns
npm run cleanup:superseded-technologies # retire legacy combined catalog rows, see below
```

### `npm run seed:demo` — the one to reach for

Wipes transactional data and rebuilds a single coherent dataset: 4 hero logins, 26 interns
(10 active / 6 ready / 5 placed / 3 completed / 2 discontinued) with ~8 weeks of attendance,
one of them a **deactivated account** (`goran.stankovic@symphony.is` — login rejected, still
listed in the admin directory and filterable via `?status=disabled`), two workspaces with a
worked-on ticket board, stand-ups in both (15 days on the main board, 8 on the QA guild), and a
12-recommendation placement pipeline. Entry point `server/seeder/seedDemoData.js`; the content
lives in `server/seeder/demo/dataset.js`.

Two invariants the preflight enforces, because getting them wrong is silent: the profile-status
histogram is pinned (so an edit can't quietly hollow out the attendance roster), and a
deactivated account may not carry an `active`/`ready` profile — `getRoster` keys off _profile_
status and never checks `user.active`, so such an intern would sit on the roster forever at 0%.

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

### `npm run seed:technologies` — safe on any environment

The odd one out: **non-destructive**. It upserts `seeder/defaultTechnologies.js` with
`$setOnInsert`, so it only ever *adds* technologies that are missing — it never renames,
reactivates or removes an existing one, and touches no other collection. Like `seed:demo` it
loads `.env.${NODE_ENV|development}`.

(One caveat on "`$setOnInsert` only": `Technology` has `timestamps: true`, and Mongoose adds
`$set: { updatedAt }` to every `updateOne` regardless. Existing rows therefore get their
`updatedAt` bumped on each run. Nothing reads that field today, but don't build
"recently added" sorting on it.)

Run it after adding entries to `defaultTechnologies.js`; the alternative is the destructive
`npm run seed`, which you do not want to point at a shared database.

```bash
npm run seed:technologies -- --dry-run   # list what would be added, change nothing
npm run seed:technologies                # add the missing technologies
```

The catalog is what bounds CV scanning — `helpers/cvTechnologyMatcher.js` can only ever
recognize technologies that already exist as `Technology` documents. Adding a technology means
three files in one change: the catalog entry, its CV aliases in the matcher, and (optionally) a
brand logo in `frontend/src/helpers/technologyIcons.jsx`.

**Check what is already there before seeding.** The catalog drifts per environment (admins can
create technologies, and retired rows stay behind), so the number added is not the same
everywhere and the database row count can exceed the catalog — `taskmanager_dev` holds 95 rows
against the 94 in `defaultTechnologies.js`, the extra being the retired `html-css`. Read the
`--dry-run` list, and watch for existing rows that overlap an incoming one.

### `npm run cleanup:superseded-technologies`

The companion to the above: `seed:technologies` only ever adds, so a legacy *combined* row
survives alongside the granular entries that replace it. `HTML & CSS` next to a new `HTML` and
`CSS` made a CV reading `HTML/CSS` match all three — one skill auto-declared as three
technologies, and three unassessed readiness items for the mentor.

This script deactivates such rows (`isActive: false`) rather than deleting them: the matcher and
`getAllTechnologies` both skip inactive, so the row leaves CV scanning and every picker, while an
intern who already declared it keeps a valid reference. Deleting would strand ObjectIds in
`selfTechnologies`. It refuses to retire a row whose replacements are not seeded yet.

```bash
npm run cleanup:superseded-technologies -- --dry-run   # report only, change nothing
npm run cleanup:superseded-technologies                # deactivate the superseded rows
```

The mapping lives in `SUPERSEDED_BY` at the top of `seeder/retireSupersededTechnologies.js` —
add a pair there when a new granular entry replaces an older combined one.

## Verifying a change

There is no integration or E2E suite. `npm test` (Jest, in `server/`) covers a handful of pure
helpers only — `slugify`, `dailyRules`, `cvTechnologyMatcher` (`helpers/*.test.js`). Run it when
you touch one of those helpers, but it proves nothing about a route, a query or a screen. To
confirm a change works, drive the real app:

- Use `/run` to launch, `/verify` to exercise the affected flow end-to-end.
- Playwright MCP browser tools are permitted for UI verification.
- For API-only changes, hit the endpoint and check the `{ success, message, data }` response
  and the DB state.
