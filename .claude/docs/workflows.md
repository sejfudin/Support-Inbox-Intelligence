# Workflows

## Prerequisites

- Node.js >= 18, npm.
- MongoDB instance (local or cloud) — `MONGODB_URI`.
- Supabase project + Storage buckets — **required**, server throws on startup without it.
  Four buckets: `SUPABASE_ATTACHMENT_BUCKET`, `SUPABASE_WORKSPACE_LOGO_BUCKET`,
  `SUPABASE_CV_BUCKET` (falls back to the logo bucket) and **`SUPABASE_PROFILE_BUCKET`**, which
  does not fall back. It must be **public** and permit `image/jpeg`, `image/png`, `image/webp`
  at 2MB or more. Do not point it at the workspace-logo bucket: that one caps objects at 1MB
  and disallows WEBP, so a valid 1.5MB JPEG and every WEBP come back as a 502 from storage —
  which reads as a broken feature, not as a misconfigured bucket. On the shared dev project the
  bucket is called `profile-images`.
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
rows with `$setOnInsert` and are safe to run anywhere. `seed:recommendations` and
`seed:fep-cohort` are additive and idempotent — they are the dataset scripts that are safe to
point at a shared dev database.

`seed:test-accounts` is additive/idempotent too, but in a different category from the other two:
it is meant to run against **production** (creates the two QA login accounts real testing needs
there) and deliberately has no `/prod|production|_live/` refusal guard — see its own section
below before assuming every seeder in this file treats a prod-looking database name as a stop
sign.

`seed:staffing-requests` is a fourth destructive one, but **narrowly** so: it deletes every
`StaffingRequest` and only those `Recommendation`s carrying a `staffingRequest` reference.
Interns, projects, users, ordinary recommendations and reference data are untouched, so unlike
`seed:demo` it can be pointed at the shared dev cluster — at the cost of every staffing request
there. It takes `--dry-run`.

```bash
# server/
npm run seed:demo   # RECOMMENDED — coherent demo dataset (see below)
npm run seed        # destructive reset + demo workspace + admin@test.com / mentor@test.com
npm run seed:test   # richer dataset (Symphony staff + interns, password: "password")
npm run seed:recommendations            # ADDITIVE: top up the placement pipeline, see below
npm run seed:test-accounts              # ADDITIVE: 2 QA login accounts (mentor/leadership),
                                        # meant for production too — see below
npm run seed:staffing-requests          # NARROWLY DESTRUCTIVE: staffing requests + their recommendations only
npm run seed:staffing-requests -- --dry-run  # inspect the target, change nothing
npm run seed:fep-cohort                 # ADDITIVE: 21-person FEP cohort across Heap / 5-Stack /
                                        # METAH + positions, workload, attendance, placements.
                                        # Idempotent; --dry-run / --skip-activity / --adopt-existing
npm run import:attendance               # attendance from the mentor's CSVs, see below
npm run cleanup:fep-attendance          # DELETES the seeded cohort's attendance, see below
npm run cleanup:fep-placements          # undoes the placements seed:fep-cohort invented
npm run seed:positions
npm run seed:technologies               # NON-destructive: adds missing technologies, see below
npm run seed:observances                # NON-destructive: 20 years of religious observances,
                                        # calendar notices only — never attendance. --dry-run /
                                        # --replace (to correct an announced Bajram date)
npm run backfill:intern-positions
npm run backfill:legacy-secondary-mentor # RUN-WHEN-READY: revokes ad-hoc mentor access, see below
npm run backfill:project-types          # ADDITIVE: types pre-existing projects (client / internal)
npm run cleanup:invitations
npm run cleanup:stale-recommendations   # close open recommendations of already-placed interns
npm run cleanup:superseded-technologies # retire legacy combined catalog rows, see below
npm run cleanup:stale-workspace-pointers # clear User.workspaceId that no membership backs, see below
npm run cleanup:orphaned-user-refs       # remove records left behind by a user deleted in the DB, see below
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
- **Preserves**: hubs, internship types, technologies, and positions.

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

### `npm run import:attendance` — real attendance from the mentor's spreadsheets

Imports the Google Sheets attendance log (`Evidencija dolazaka …`) into `Attendance`. One CSV per
month tab, UTF-8; **do not open the export in Excel first** — that re-encodes it and destroys the
Bosnian diacritics.

```bash
node seeder/importAttendanceCsv.js ~/Downloads/Evidencija*.csv                  # dry run (default)
node seeder/importAttendanceCsv.js ~/Downloads/Evidencija*.csv --apply --yes=<dbname>
```

Call `node` directly when the filenames contain spaces — `npm run … --` word-splits them.

Built to be safe against production: **dry run is the default**, writing needs `--apply` plus the
`--yes=<dbname>` target assertion, and it is **insert-only** (upsert on the unique `{ intern, date }`
index, so a re-run inserts nothing and can never double-count or overwrite a genuine check-in).

Things worth knowing:

- **`TRUE` creates a row; `FALSE`/blank create nothing** — which is exactly how the model encodes
  absence, so nothing is lost. The sheet's excused-vs-absent nuance is *not* preserved: there is no
  field for it.
- **Interns are matched by diacritic-folded full name against accounts in the database**, never a
  hardcoded roster. An ambiguous fold or an unmatched name aborts the whole import
  (`--allow-unmatched` to accept the gap) — a silently skipped person reads as total absence.
- Header cells are `d/m` with no year; the **year comes from the filename** (`… June 2026.csv`).
  `A1` and any trailing `%` column are ignored, because the sheet is hand-edited and `A1` has held
  `Datum`, a stray intern name, and nothing at all across months.
- **It also repairs `InternProfile.startDate`, by default.** `computeMonthStats` clamps a month to
  `max(monthStart, profile.startDate)`, so a `startDate` later than the imported history makes that
  history read `0 / 0` and 0% even though the rows are there. The rule is
  `min(existing, firstAttendedDay)` — only ever earlier, so a correct date can never be lost, which
  is what makes it safe on by default. It matters because production's database was reset by
  accident and every intern carries a recent date instead of the real March programme start.
  `--keep-start-dates` opts out. This is the one thing the importer writes outside `Attendance`.

### `cleanup:fep-attendance` / `cleanup:fep-placements` — undo the seeder's fabrications

`seed:fep-cohort` can invent attendance and placements. Both are **off by default**
(`--fake-attendance`, `--fake-placements`) because they corrupt real data: invented check-ins fill
the gaps the real sheet records as absences, and a fabricated placement flips the profile to
`placed`, which removes that intern from the attendance roster and the interns table entirely.
These two scripts undo what earlier runs already wrote — the placement one matches only on the
seeder's own marker note, so genuine placements are untouched. Both take `--dry-run`.

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

### `npm run seed:test-accounts` — the one seeder meant for production

Creates exactly two accounts — one `mentor`, one `leadership` — flagged `isTestAccount: true`
(`server/models/User.js`), real and login-capable (active, hashed password), for internal QA.
That flag is what keeps them out of every user-facing listing that surfaces mentors/leadership
(mentor pickers, the mentor-notes audience picker, the specialization picker, Platform
Management's own "All Users" screen by default — see `adminService.getUsers`'s
`includeTestAccounts` param) regardless of which database they live in. Matched by **email**;
an account that already exists is left untouched and reported as present. Nothing else is
touched — no deletes, no updates to any other user.

**No `/prod|production|_live/` refusal guard, unlike every other seeder in this file** — the
whole point is that these accounts need to exist in production. The safety gate is the same
typed-database-name confirmation the other seeders use; nothing is written until a human reads
the banner and types the target database's name back.

The password is never hardcoded in the script — required via `TEST_ACCOUNT_PASSWORD` in the
environment, so no credential (however low-stakes) sits in git history.

```bash
TEST_ACCOUNT_PASSWORD=... npm run seed:test-accounts -- --dry-run
TEST_ACCOUNT_PASSWORD=... npm run seed:test-accounts                    # interactive: type the DATABASE NAME to confirm
TEST_ACCOUNT_PASSWORD=... npm run seed:test-accounts -- --yes=<dbname>  # non-interactive; the flag must assert the db name
```

Requires at least one `Hub` to already exist in the target database (picks the alphabetically
first one) — run reference-data seeding first on a database that has none.

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

**Know which database you are seeding.** `.env.development`'s `MONGODB_URI` carries **no database
name** (it ends `mongodb.net/?appName=Cluster0`) and `config/db.js` passes no `dbName`, so Mongoose
falls back to its default and both the API and every seeder land in a database literally called
`test` on the dev cluster. That is the database `npm run dev` serves and the one `/my-technologies`
reads — it only looks like a stray. The banner every seeder prints is the thing to trust.

**Check what is already there before seeding.** The catalog drifts per environment (admins can
create technologies, and retired rows stay behind), so the number added is not the same everywhere
and the database row count can exceed the catalog. As of the 302-entry expansion the dev database
holds 306 rows: the catalog plus four **active** discipline rows — `devops`, `data-engineering`,
`data-science`, `machine-learning` — that duplicate Position titles and were never retired there.
`createTechnology` blocks new ones (`assertNotAPosition`), but the existing four still show in the
intern's picker; `npm run cleanup:discipline-technologies` is what retires them, and eight intern
declarations hang off three of them. Read the `--dry-run` list, and watch for existing rows that
overlap an incoming one.

**The catalog is 302 entries and was 90 until recently.** It grew in one change that added the
Design & UX, Security, Game development and Embedded & hardware groups, because
`seeder/defaultPositions.js` names those four tracks and the catalog held nothing an intern on
any of them could declare. Any environment seeded before that is ~212 rows behind, so
`seed:technologies` has real work to do everywhere — expect a long `--dry-run` list rather than
the handful the earlier wording implies.

### `npm run cleanup:superseded-technologies`

The companion to the above: `seed:technologies` only ever adds, so a legacy *combined* row
survives alongside the granular entries that replace it. `HTML & CSS` next to a new `HTML` and
`CSS` made a CV reading `HTML/CSS` match all three — one skill auto-declared as three
technologies, and three unassessed readiness items for the mentor.

This script deactivates such rows (`isActive: false`) rather than deleting them: the matcher and
`getAllTechnologies` both skip inactive, so the row leaves CV scanning and every picker, while an
intern who already declared it keeps a valid reference. Deleting would strand ObjectIds in
`selfTechnologies`. It refuses to retire a row whose replacements are not seeded yet.

Anything that *validates* technology ids on write has to honour that: a staffing request edit
exempts the ids the request already carries from the active check (only newly added ones must be
active), and the edit form merges them back into the active-only picker list so they still render
as chips. Without both halves, one retired technology freezes every edit of the request.

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

### `npm run cleanup:orphaned-user-refs`

There is no in-app "delete user" path (see `.claude/docs/security.md`), so a User only ever leaves
the database by hand — and nothing cascades when it does. The InternProfile survives, and with it
every recommendation, evaluation, attendance row and absence request hanging off that profile. Each
one renders as a row reading "Unknown", counted in the total beside it.

`server/helpers/orphanedProfiles.js` and `server/repository/liveUserFilter.js` are the read-side
guards that keep those rows off screen (see `.claude/docs/security.md`); this script removes the
records, which is the only thing that also repairs the raw counts.

It **reports** every dangling `ref: 'User'` in every model, found by walking the Mongoose schemas —
a ref added later shows up without editing the script. It **deletes** only records with no subject
left: an orphaned InternProfile, everything keyed to one, and the per-user rows (refresh tokens,
notifications, AI summaries, invitations) that mean nothing without their owner. It **keeps**
dangling authorship and membership refs (`updatedBy`, `evaluator`, `author`, `Ticket.assignedTo`,
workspace members, ticket message senders) — those records still describe something that happened;
`--prune-refs` clears just those fields while keeping the records.

The schema walk descends into embedded documents and document arrays, and reads a ref declared as
`[{ type: ObjectId, ref: 'User' }]`. It has to: `eachPath` reports a sub-document as one node and
never yields the paths inside it, and it leaves `caster.options` empty for an array of ids. A walk
that only reads top-level `options.ref` misses eight refs in the current schema set — among them
`Workspace.members[].user`, `Ticket.messages[].sender`, `Ticket.assignedTo` and
`Ticket.reviewRequest.reviewer` — and reports "no dangling refs" while they dangle.

`--prune-refs` refuses two kinds of field and lists what it skipped:

- a **required** scalar (`Workspace.owner`, `Ticket.creator`, `InternProfile.primaryMentor`).
  `updateMany` does not run validators, so the `$unset` would otherwise succeed silently and leave
  a workspace with no owner — worse than the dangling id. Reassign those in the app.
- a ref **inside a document array** (`Workspace.members[].user`, `Ticket.messages[].sender`,
  `Daily.entries[].member`). The dotted path is not writable, and the one-operator alternative is
  `$pull`ing the whole element — which deletes a membership or a message instead of repairing it.

Dry-run is the default. Unlike the seeders this one does **not** refuse a production-looking
database name — repairing production is the reason it exists — so the guard is that every write
needs the database name asserted out loud.

```bash
npm run cleanup:orphaned-user-refs                          # report only, change nothing
npm run cleanup:orphaned-user-refs -- --apply               # prompts for the database name
npm run cleanup:orphaned-user-refs -- --apply --yes=<dbname> # non-interactive (assertion required)
npm run cleanup:orphaned-user-refs -- --apply --prune-refs  # also clear authorship/membership refs
```

To point it at a database other than the one in `server/.env.development`, set `MONGODB_URI` for
the run. Always do a plain (dry-run) pass first and read the plan.

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
6. `migrate:remove-unspecified-sentinel` — `Recommendation.project` is no longer required;
   repoints any recommendation still pointing at the locked "Unspecified" sentinel to `null`, then
   deletes the sentinel. Runs after steps 2 and 4, which both depend on the sentinel still existing.

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
`slugify`, `dailyRules`, `cvTechnologyMatcher`, `cvTechnologySync`, `staffingRequestRules` and
`userAvatar` (`helpers/*.test.js`; the avatar one covers the accepted file types and the
object-key shape) — plus four services that mock Mongo and Supabase: `userAvatarService`
(`services/userAvatarService.test.js`), for the upload → repoint → delete-the-old ordering and
the cleanup when a save fails, `internCvService`
(`services/internCvService.test.js`), for the CV re-upload → technology replacement wiring,
`internService` (`services/internService.test.js`), for the CV-scan provenance prune on a manual
technology save, and `staffingRequestService` (`services/staffingRequestService.test.js`), for the
close / edit / put-forward wiring around the rules helper — which note field each close reason
writes, which reasons require one at all, that closing runs the close-out cascade and names its
consequence in the trail, and the 403-vs-400 split.

`npm test` in `frontend/` (vitest) is narrower still: pure helpers under `src/helpers/*.test.js`,
including `staffingRequests.test.js` for the presentation predicates that read `progress`, plus
`src/hooks/useStagedPicks.test.js` for the pure half of the staged-picks cart (its `sessionStorage`
mirroring is not covered — drive the app for that) and a colocated `requestPresentation.test.js`
next to the staffing-request components, for the pure predicates that live there. No component is
rendered in a test anywhere.

Run them when you touch any of those, but they still prove nothing about a route, a query or a
screen. To confirm a change works, drive the real app:

- Use `/run` to launch, `/verify` to exercise the affected flow end-to-end.
- Playwright MCP browser tools are permitted for UI verification.
- For API-only changes, hit the endpoint and check the `{ success, message, data }` response
  and the DB state.
