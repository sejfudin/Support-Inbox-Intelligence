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
rows with `$setOnInsert` and are safe to run anywhere. `seed:recommendations` is additive and
idempotent — it is the one dataset script that is safe to point at a shared dev database.

```bash
# server/
npm run seed:demo   # RECOMMENDED — coherent demo dataset (see below)
npm run seed        # destructive reset + demo workspace + admin@test.com / mentor@test.com
npm run seed:test   # richer dataset (Symphony staff + interns, password: "password")
npm run seed:recommendations            # ADDITIVE: top up the placement pipeline, see below
npm run seed:positions
npm run seed:technologies               # NON-destructive: adds missing technologies, see below
npm run backfill:intern-positions
npm run backfill:legacy-secondary-mentor # RUN-WHEN-READY: revokes ad-hoc mentor access, see below
npm run backfill:project-types          # ADDITIVE: types pre-existing projects (client / internal)
npm run cleanup:invitations
npm run cleanup:stale-recommendations   # close open recommendations of already-placed interns
npm run cleanup:superseded-technologies # retire legacy combined catalog rows, see below
npm run cleanup:stale-workspace-pointers # clear User.workspaceId that no membership backs, see below
```

### `npm run seed:demo` — the one to reach for

Wipes transactional data and rebuilds a single coherent dataset: 4 hero logins, 26 interns
(10 active / 6 ready / 5 placed / 3 completed / 2 discontinued) with ~8 weeks of attendance,
one of them a **deactivated account** (`goran.stankovic@symphony.is` — login rejected, still
listed in the admin directory and filterable via `?status=disabled`), two workspaces with a
worked-on ticket board, stand-ups in both (15 days on the main board, 8 on the QA guild), and a
38-recommendation placement pipeline covering **every** intern. Entry point
`server/seeder/seedDemoData.js`; the content lives in `server/seeder/demo/dataset.js`.

Invariants the preflight enforces, because getting them wrong is silent:

- The profile-status histogram is pinned, so an edit can't quietly hollow out the attendance roster.
- A deactivated account may not carry an `active`/`ready` profile — `getRoster` keys off _profile_
  status and never checks `user.active`, so such an intern would sit on the roster forever at 0%.
- Every intern has at least one recommendation, and the interns in `RECOMMENDATION_MULTI_KEYS`
  have several (so the demo can show a real placement journey, not one row per person).
- Recommendation status agrees with the intern's profile status. The rules live in
  `server/seeder/demo/recommendationRules.js` and mirror `recommendationService`: `active` interns
  get open stages only (resolving one as `not_placed` moves the profile to `ready`, so the app
  itself can never leave a resulted recommendation on an `active` intern); `placed`/`completed`/
  `discontinued` interns get resulted ones only, with exactly one `placed` outcome for a `placed`
  profile.

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

### `npm run seed:recommendations` — additive, safe on a shared dev DB

Inserts the placement pipeline from `demo/dataset.js` for interns who are missing it. **Nothing is
deleted and no existing recommendation is modified** — the only writes are new `Recommendation`
documents plus the `History` rows for their status timeline. That is what makes it the one dataset
script you can point at `taskmanager_dev` without coordinating with the team, unlike `seed:demo`,
which wipes every user id and breaks everyone's open sessions.

Reach for it when the dev database already has real work in it (tickets people are testing against,
profiles moved by hand) and the only gap is an empty pipeline. Reach for `seed:demo` when you want
the whole coherent dataset back.

```bash
npm run seed:recommendations -- --dry-run       # print the plan, write nothing
npm run seed:recommendations                    # interactive: type the DATABASE NAME to confirm
npm run seed:recommendations -- --yes=<dbname>  # non-interactive; the flag must assert the db name
```

Same env loading and same confirmation rules as `seed:demo` (`.env.${NODE_ENV|development}`,
database-name assertion, refuses `/prod|production|_live/`). Three things make re-running harmless:

- Recommendations are written with the demo seeder's deterministic `_id`
  (`stableId('recommendation:<key>')`), so "already present" is an id lookup, not a fuzzy match.
  A second run inserts zero rows.
- People and reference data resolve by **email** and **slug**, never by seeded id, so it also works
  where users were created through the app. Anything unresolvable is skipped with a reason, printed,
  rather than aborting the run.
- Each spec is re-checked against the intern's **live** profile status and the recommendations
  already in the database before being written, using the same
  `demo/recommendationRules.js` used by the `seed:demo` preflight. A profile someone has since moved
  to `placed`/`completed`/`discontinued` will not receive an open recommendation that would sit in
  the pipeline KPI forever. Pre-existing incoherence in the database is reported as a warning and
  does not block the rest of the pipeline.

The spec→document mapping is shared with the demo seeder (`demo/recommendationDocs.js`), so both
paths produce identical records. It ends with a per-intern coverage table and an explicit check that
no intern profile is left without a recommendation.

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

### `npm run cleanup:stale-workspace-pointers`

`User.workspaceId` is the workspace a user last switched to — a pointer, not proof of membership
(see `.claude/docs/security.md`). It goes stale when a user is downgraded from admin/mentor to
intern/leadership (the `canAccessAnyWorkspace` bypass disappears, the pointer stays), or when a
membership is flipped to `invited`/`disabled`. The API no longer honors a stale pointer, but it
still drives what the UI offers, so clear it in the data too.

Safe against any environment — it only ever rewrites `workspaceId`, skips admins/mentors (whose
pointer needs no membership), and repoints a user to another workspace they *are* an active
member of when one exists, mirroring `workspaceService.removeMember`. Idempotent.

```bash
npm run cleanup:stale-workspace-pointers -- --dry-run   # report only, change nothing
npm run cleanup:stale-workspace-pointers                # prompts before writing
npm run cleanup:stale-workspace-pointers -- --yes       # non-interactive
```

### `npm run backfill:legacy-secondary-mentor` — run-when-ready, revokes access

`secondaryMentor` used to be set ad-hoc at invite time; it's now repurposed to mean exactly the
specialization mentor, marked by `InternProfile.specializationAssignedAt` (ADR 0002). This script
nulls `secondaryMentor` on every profile where `specializationAssignedAt` is still null, and
leaves specialized profiles untouched. Additive/idempotent — a second run modifies nothing.

**CAUTION:** a legacy `secondaryMentor` currently grants that mentor `isAssignedMentor` access to
the intern; nulling it removes that access. This is intended, but it's a behavior change on live
data — run it once the team is prepared to (re)assign specializations for anyone who genuinely
needs the pairing, on **each** database (dev and main/production both need their own run once
ready).

```bash
npm run backfill:legacy-secondary-mentor -- --dry-run          # report the plan, write nothing
npm run backfill:legacy-secondary-mentor                       # interactive: type the DATABASE NAME
npm run backfill:legacy-secondary-mentor -- --yes=<dbname>     # non-interactive; must assert the db name
```

### Bringing an existing database up to date with a schema change — `npm run migrate:development-merge`

There is no migration framework — Mongoose schema changes only take effect for documents written
after the deploy. When a branch adds a required field, narrows an enum, or drops a field a status
depended on, existing documents on any database that predates the change need a one-off backfill
or they'll fail validation on their next write (or keep echoing a field the app no longer reads).

`server/seeder/mergeDevelopmentToMaster.js` runs, in order, every backfill/migration needed to
bring a pre-existing database (e.g. the main-branch DB, before merging `development` into it) up
to date with the current model set:

1. `seed:positions` — Position catalog must exist before step 3 can fall back to it.
2. `migrate:recommendation-projects` — creates the locked "Unspecified" sentinel `Project` and
   repoints any legacy free-text `Recommendation.project` value at it.
3. `backfill:recommendation-fields` — rewrites the retired `draft` status to `recommended`,
   backfills the now-required `position`, drops stale `placed` history rows from an earlier
   migration version, and tops up status `History` rows for old records.
4. `backfill:project-types` — sets the now-required `Project.type` on projects created before the
   field existed (`client`, or `internal` for the locked "Unspecified" sentinel). Runs after step 2
   so the sentinel that step creates gets typed too.
5. `cleanup:ready-for-placement` — removes the orphaned `readyForPlacement` boolean now that
   `InternProfile.status` covers the same concept via the `ready` value.

```bash
npm run migrate:development-merge
```

Deliberately **not** included: `backfill:intern-positions`. That script assigns a *random*
`Position` to any intern profile missing `declaredPosition` — fine for demo/test data, wrong for
real intern records. Leave `declaredPosition` null on a real database; step 3 already falls back
to a default `Position` per-record when it's missing, and mentors can set the real
`declaredPosition` by hand. Run `backfill:intern-positions` yourself, deliberately, only against
a database where random assignment is acceptable (dev/demo).

Also deliberately **not** included: `backfill:legacy-secondary-mentor`. It revokes real mentor
access (see above), so it's run-when-ready rather than automatic — run it yourself once the team
is prepared, not as a side effect of a merge.

Each step is its own idempotent, safe-to-re-run script — the wrapper just enforces run order and
stops at the first failure. Every underlying step is additive/corrective only (no collection is
wiped), so it's safe to run against a shared or production database, but it still writes real
data — confirm you're pointed at the intended `MONGODB_URI` (via `NODE_ENV`) before running it.
Adding a new required field or removed enum value in a future change means adding a new backfill
script and a new step here, in the same change that alters the model.

## Verifying a change

There is no integration or E2E suite. `npm test` (Jest, in `server/`) covers pure helpers —
`slugify`, `dailyRules`, `cvTechnologyMatcher`, `cvTechnologySync` (`helpers/*.test.js`) — plus two
services that mock Mongo and Supabase: `internCvService` (`services/internCvService.test.js`), for
the CV re-upload → technology replacement wiring, and `internService`
(`services/internService.test.js`), for the CV-scan provenance prune on a manual technology save.
Run them when you touch any of those, but they still prove nothing about a route, a query or a
screen. To confirm a change works, drive the real app:

- Use `/run` to launch, `/verify` to exercise the affected flow end-to-end.
- Playwright MCP browser tools are permitted for UI verification.
- For API-only changes, hit the endpoint and check the `{ success, message, data }` response
  and the DB state.
