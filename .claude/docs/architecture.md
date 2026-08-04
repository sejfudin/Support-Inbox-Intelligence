# Architecture

## Two domains

1. **Programme management** — interns, mentors, evaluations, mentor comments, readiness flags,
   recommendations, leadership dashboards.
2. **Ticketing / project work** — workspace-scoped tickets with custom statuses, priorities,
   story points, time-in-status, threaded comments + @mentions, change history, board + table
   views, archiving, CSV export.

## Platform roles

Defined in `server/constants/roles.js` (`ROLES` = `admin | mentor | intern | leadership`).
Roles are assigned at the **user** level and drive route landing + guards.

| Role | Lands on | Capability |
|---|---|---|
| Admin | `/dashboard` (admin dashboard) if they have an active workspace, else `/admin/workspaces` | Full access. Manages users, workspaces, reference data. **Bypasses workspace membership checks** for tickets/rooms. |
| Mentor | `/my-interns` | Guides assigned interns via mentor notes and documentation links only. Evaluations, readiness, recommendations, the attendance roster, the internal CV link, and lifecycle status changes are admin-only — see `.claude/docs/security.md` ("Intern access"). Works in workspaces on tickets. Can create workspaces (becomes owner) and manage/delete the ones they own or workspace-admin — no global workspace list. |
| Leadership | `/programme` | Read-oriented stakeholder view. No ticket/workspace workflow — redirected to `/programme`. |
| Intern | `/dashboard` or `/create-workspace` | Manages own profile; works on assigned tickets in their workspace. |

**Two authorization layers** — do not conflate:
- **Platform role** (above) — `admin/mentor/intern/leadership`.
- **Workspace membership role** — `admin` / `member` — controls per-workspace management actions,
  independent of platform role. See `.claude/docs/security.md`.

## Data model (Mongoose, `server/models/`)

Core: `User`, `Workspace`, `Ticket`, `TicketStatus`, `Category`, `Comment`, `History`,
`Notification`, `RefreshToken`, `Integration`, `Daily`.
Programme: `InternProfile`, `Evaluation`, `MentorComment`, `ReadinessFlag`, `Recommendation`,
`Attendance`, `Position`, `Project`, `Hub`, `Technology`, `InternshipType`, `Invitation`.
AI: `AISummary`.

- Tickets, statuses, categories, comments all carry a `workspace` ref — the scoping anchor.
- Statuses are **per-workspace and customizable** (not a global enum). See `statusService` and
  `server/helpers/statusValidation.js` / `statusSlugAliases.js`.
- `Daily` — one standup record per `(workspace, date)` (unique compound index), with embedded
  `entries` (one per reporting intern: `done`/`todo` text lists + `blockers`, each blocker an
  optional `linkedTicket` ref scoped to the same workspace). Pure edit-window/derived-count logic
  lives in `server/helpers/dailyRules.js`. An admin-only cross-workspace reporting overview
  (`getWorkspaceDailyOverview`/`getMemberDailyEntry` in `dailyService.js`, routed at
  `/api/dailies/admin/*`) derives a calendar-month reporting-coverage grid and per-member entry
  detail from the same documents — no new schema. See ADR-0001.

## Auth flow

- Login issues a short-lived **access token** (JWT) + a rotating **refresh token**.
- **Both tokens are stored in `localStorage`** (`accessToken`, `refreshToken`) — see
  `frontend/src/api/axios.js` and `src/context/AuthContext.jsx`. The access token is sent as
  `Authorization: Bearer <token>` via the axios request interceptor.
- Refresh: axios response interceptor catches 401, reads `refreshToken` from `localStorage`,
  calls the refresh endpoint, stores the new tokens, and retries queued requests
  (single-flight via `isRefreshing` + `failedQueue`). On refresh failure it clears both tokens.
- `server/middleware/auth.js` `protect` verifies the JWT, loads the user, and rejects if
  `decoded.tokenVersion !== user.tokenVersion` (logout-everywhere / rotation invalidation).
- Refresh tokens persisted (`RefreshToken` model); `tokenVersion` on `User` gates validity.
  Logic in `server/services/authService.js`.

## Real-time (Socket.IO, `server/socket/`)

- `socketServer.js` — server setup, authenticated handshake (same JWT + tokenVersion check),
  per-event rate limiting, room-level authorization.
- `events.js` — event names + emit helpers.
- `invalidationScopes.js` — room key builders that drive React Query cache invalidation:
  - `user:<id>`, `workspace:<id>`, `workspace-tickets:<id>`, `ticket:<id>`,
    `workspace-dailies:<id>`.
- Frontend consumes via `src/context/SocketContext.jsx`, invalidating query keys on events.

## Integrations

- **Groq AI** (`server/services/groqAiClient.js` + `aiSummaryService`, `ticketDescriptionGenerationService`,
  `ticketMetadataSuggestionService`; prompts in `server/prompts/`). Optional — gated on env vars.
- **GitHub App** (`server/services/githubService.js`, `autoLinkService.js`) — webhook-driven PR
  linking. RS256 JWT; installation tokens encrypted at rest (`server/helpers/crypto.js`).
- **Supabase Storage** (`server/config/supabase.js`) — attachment images, workspace logos, intern CVs.
  Server throws on startup if Supabase env vars missing.
- **CV technology auto-detection** — when an intern uploads a CV (`POST /interns/me/cv`), the PDF
  text is extracted (`pdf-parse`, `server/helpers/pdfText.js`) and matched against the canonical
  `Technology` catalog (deterministic keyword/alias matching, `server/helpers/cvTechnologyMatcher.js`).
  Recognized technologies are merged into `InternProfile.selfTechnologies` — same effect as a
  manual add, no `ReadinessFlag` created, so each reads "Not assessed" until a mentor assesses it.
  Best-effort by design: an unreadable/image-only PDF just adds nothing (never fails the upload),
  and the manual "Add a technology" flow remains for anything not recognized. See
  `server/services/internCvService.js` (`syncTechnologiesFromCv`).

  **A re-upload replaces the previous scan, it does not accumulate.** `selfTechnologies` mixes two
  sources, so the scan needs provenance to know what it may take back: `InternProfile.cvTechnologies`
  records the subset it added (always a subset of `selfTechnologies`, stripped from API responses in
  `formatProfile`). On re-upload, technologies that were CV-added but are absent from the new CV are
  removed, matches are added, and the rest is left alone. Reconciliation is a pure function —
  `server/helpers/cvTechnologySync.js` (`reconcileCvTechnologies`), covered by
  `cvTechnologySync.test.js`. The rules that matter:

  - **Manual declarations are never removed.** A technology the intern declared before a scan
    matched it stays theirs; only what a scan actually added is CV-owned. `updateSelfTechnologies`
    prunes `cvTechnologies` to what is still declared, so removing a CV-added technology by hand
    hands it back to the intern.
  - **A readable CV that matches nothing still clears the previous scan** — that is a real result,
    not a failure.
  - **An unreadable CV changes nothing.** Text we could not extract is not evidence the intern
    dropped a skill, so a corrupt/image-only re-upload leaves the existing list intact rather than
    wiping it. Removal also leaves any existing `ReadinessFlag` alone (re-assessing is the mentor's
    call, and re-adding the technology restores its flag).
  - Profiles that last uploaded a CV before this field existed have an empty `cvTechnologies`, so
    their first re-upload adds without removing; it self-corrects from the next upload on. No
    backfill is possible — the old scan's contributions were never recorded.

  **The catalog is the ceiling.** Matching is scoped to `Technology` rows, so a skill with no
  catalog entry is invisible to the scan however it is spelled — a thin catalog reads as a
  broken scanner. Adding a technology therefore takes three steps in the same change:
  `seeder/defaultTechnologies.js` (the entry), `helpers/cvTechnologyMatcher.js`
  (`TECHNOLOGY_ALIASES` — the real-world spellings; version-suffixed forms like `html5`/`python3`
  need their own alias, the bare one will not match them), and `npm run seed:technologies` to
  backfill databases that were seeded before the addition. `helpers/cvTechnologyMatcher.test.js`
  fails if a seeded slug has no alias entry.

## Recommendations (placement pipeline)

A recommendation is a mentor's placement proposal for an intern: a position + **project** (ref to
`Project`, an admin-managed reference entity — see below) + technologies, moving through a
**forward-only status lifecycle** with a separate placement outcome. Backend:
`server/{models/Recommendation.js, services/recommendationService.js,
controllers/recommendations.js, routes/recommendations.js}`. Frontend:
`frontend/src/components/interns/InternRecommendationsPanel.jsx` (data wiring + dialogs state)
composing `components/interns/recommendations/` (`RecommendationCards`, `RecommendationModals`,
`recommendationUi` — cards, view/edit/create modals, delete confirm, timeline, design tokens).

**Status lifecycle** — `recommended → interviewing → resulted`. Enforced server-side:

- A new recommendation always starts at `recommended` (create rejects anything else).
- `PATCH` rejects backward moves ("status can only move forward"); the edit modal shows earlier
  stages locked with a padlock. Setting a placement outcome forces status to `resulted`.
- **Interviewing can be skipped**: jumping straight `recommended → resulted` (or sending
  `statusDates.interviewing: null` on a resulted record) leaves interviewing dateless — rendered
  as a dashed "Skipped" step, distinct from "Pending" (not reached yet).

**Status dates** — `Recommendation.statusDates.{recommended,interviewing,resulted}` are the
authoritative, author-editable dates each stage was reached (each defaults to now when a stage
is first reached; may be backdated). Ordering is validated (`recommended ≤ interviewing ≤
resulted`) on the server, on submit, and via date-picker `min`. The append-only `History` log
(`entityType: 'recommendation'`, `statusKey`) remains the audit trail and the **fallback for
records that predate `statusDates`**; editing such a record seeds its dates from history first.

**Placement outcome** (`result.outcome`: `placed | not_placed`, note required) syncs the intern's
lifecycle status (`InternProfile.status`):

- `placed` → profile `placed`; `not_placed` → profile `ready` (back on the bench). Terminal
  states (`completed` / `discontinued`) are never touched.
- A recorded outcome can be changed but never removed.
- **Delete recomputes from the most recent remaining recommendation**: newest is `placed` →
  stays `placed`, anything else (or none left) → `ready`. Deleting also removes the record's
  history trail. The confirm dialog warns when deleting the placement that marked the intern placed.

**Create guards (UI)** — backend already rejects create with 409 when the intern's profile is
`placed` / `completed` / `discontinued`. The Recommendations tab mirrors that: **New
recommendation** is greyed out with a hover explanation when the profile is in one of those
statuses. Concurrent open recommendations across projects remain allowed, but creating a second
one while the intern already has a `recommended` / `interviewing` recommendation on a *different*
project shows a confirm dialog naming both projects before the create proceeds.

**Roles** — admin-only. Reads and writes (create/update/delete) both require `admin`
(`assertReadAccess` / `assertRecommendationWriteAccess` in `recommendationService.js`); `leadership`
additionally has read access (fully read-only UI — no create/edit/delete controls rendered).
Mentors have no access at all, on the per-intern tab or the standalone `/recommendations` page.

### Project (reference entity)

`Project` (`server/models/Project.js`) is the canonical list of client engagements a
recommendation can point at (title, client, description, tech tags, `status`:
`active | on_hold | completed`). Firm-global reference data, same pattern as `Technology`/
`Position` — **not** workspace-scoped despite the general "workspace-scope every resource" rule
(that rule applies to the ticketing domain, not intern/recommendation reference data).

- **Admin-only** create/edit (`requireRole(ROLES.ADMIN)`) — mentors can only select a project when
  writing a recommendation, they cannot manage the list. Managed from the "Projects" tab on
  `/admin/platform-management` (`ReferenceDataProjectsPanel`).
- Only `status: active` projects are offered in the recommendation form's project picker;
  `on_hold`/`completed` stay on existing recommendations but drop out of the picker for new ones.
- A locked sentinel project (`slug: 'unspecified'`, `isSystem: true`) exists because
  `Recommendation.project` used to be free text — the one-off
  `server/seeder/migrateRecommendationProjects.js` repoints every pre-existing recommendation at
  it (old free-text values are discarded, not preserved). The sentinel can't be edited or deleted
  and never appears in the recommendation picker.
- "Which interns are on project X" is a **derived read** (query `Recommendation` by `project`),
  not a stored roster — there is no members/roster field on `Project` by design.

## Attendance (office check-in)

Interns check in once per office day; admins get a read-only roster (with a per-intern calendar
modal). Backend:
`server/{models/Attendance.js, services/attendanceService.js, controllers/attendance.js,
routes/attendance.js}` + `server/helpers/attendanceTime.js`. Frontend:
`frontend/src/pages/{MyAttendancePage,AttendanceOverviewPage}.jsx`, `components/attendance/*`,
`helpers/attendance.js`, `api/attendance.js`, `queries/attendance.js`.

- **Sparse storage — one document per intern per acted-on day** (`Attendance`: `intern` →
  `InternProfile`, `date` as office-local `'YYYY-MM-DD'` string, `status: present | cancelled`,
  `checkedInAt`, `hub`, `checkInIp`). Absent days are **not** stored — absence is the lack of a
  record, derived at read time. A unique `{ intern, date }` index makes double check-ins
  idempotent (concurrent inserts race safely) and keeps a day to a single row that check-in and
  cancel flip between.
- **Cancel unchecks the day, it does not lock it**: the record is flipped to `cancelled` (not
  deleted) and reads as absent, but `checkIn()` flips that same row back to `present` (re-stamping
  `checkedInAt`/`hub`/`checkInIp`) for as long as the check-in window is open — the window closing
  is the only thing that settles a day. A repeat check-in on an already-`present` day is a no-op
  that preserves the original `checkedInAt`. All of this is app-level in `attendanceService.js`;
  nothing schema-level constrains the `present`↔`cancelled` transitions.
- **Reporting is per calendar month, never cumulative** (no all-time rate). `presentDays` /
  `workingDays` (Mon–Fri) / `attendanceRate` are computed for one month at a time, clamped to
  `[max(monthStart, startDate), min(monthEnd, today)]` — so a mid-month joiner isn't penalised and
  the current month only counts elapsed days. Always computed from raw records, never stored, so
  they can't go stale (`computeMonthStats` in `server/helpers/attendanceStats.js` — shared by the
  roster and the admin dashboard; unit-tested in `attendanceStats.test.js`).
- **Check-in window** (`attendanceTime.js`): open 07:00–11:00 `Europe/Sarajevo` time on weekdays.
  The server is authoritative; the client mirrors the rule for UX only.
- Endpoints: `GET /api/attendance/me` (full history for the calendar/streak + a current-month stat
  block), `POST|DELETE /api/attendance/me/check-in` (intern-self); `GET /api/attendance` (**admin-only**
  roster, `?month=YYYY-MM&search=&hub=`, defaults to the current month, records scoped to that month
  so the payload stays bounded, and only `active`/`ready` interns — `InternProfile`'s exported
  `IN_PROGRAMME_STATUSES` — a `placed`/`completed`/`discontinued` intern drops off the roster
  entirely) and
  `GET /api/attendance/:internProfileId` (**admin-only**, one intern's full history for the
  calendar modal, no status filter). Response envelope is the standard
  `{ success, message, data }`, with `data` holding `{ attendance }` / `{ month, roster }`.
- The office-network **IP allowlist** guard (per-hub CIDR + `trust proxy`) is a deferred, optional
  step — `Attendance.checkInIp` is already captured for it.

## Admin dashboard (workspace-scoped)

The admin landing board: one workspace at a time — the caller's **active** workspace. Backend:
`server/{services/adminDashboardService.js, controllers/adminDashboard.js}` +
`GET /dashboard` in `routes/admin.js`. Frontend:
`frontend/src/pages/AdminDashboardPage.jsx`, `components/admin/dashboard/*`,
`api/adminDashboard.js`, `queries/adminDashboard.js`.

- **`/dashboard` is role-split**, not a separate route: `DashboardRoute` in
  `routes/AppRoutes.jsx` renders `AdminDashboardPage` for admins and `UserDashboard`
  (assigned tickets) for everyone else. It sits **outside `WorkspaceGuard`** so an admin with no
  active workspace gets the board's own explanation rather than a redirect to `/create-workspace`
  — the guard's redirects are repeated inside `DashboardRoute` for the non-admin branch only.
  Don't widen `WorkspaceGuard` instead: `/tickets`, `/dailies` and `/analytics` all assume a
  resolved `user.workspaceId`.
- **The page has no workspace picker of its own** — it reads `user.workspaceId`, and switching is
  the sidebar's `WorkspaceSwitcher` (which already `refetchUser()`s and navigates to `/dashboard`,
  so the board re-keys and refetches by itself). Note the switcher lists only workspaces the
  caller is a *member* of and collapses to a static "Global admin mode" label when an admin has no
  active workspace — which is why the empty state points at `/admin/workspaces` instead of the
  sidebar.
- **Scoping goes through `Workspace.members`, never `User.workspaceId`** —
  `server/helpers/workspaceInterns.js` (`getActiveWorkspaceInterns`), also used by `dailyService`. `InternProfile` has **no** `workspace` field, and
  `User.workspaceId` is only the member's *currently active* workspace, so scoping on it would
  drop interns who belong here but are switched elsewhere.
- **Presence + the workload table count only in-programme interns**
  (`InternProfile.IN_PROGRAMME_STATUSES` — `active`/`ready`, the same list the attendance roster
  filters on) — a placed or discontinued intern has no live workload or attendance to report.
- **The two placement cards are the one global thing on the page.** "Last intern placed" and
  "Recent placements" query `Recommendation` with `result.outcome: 'placed'` across the **whole
  platform**, unscoped — placement is a programme-level milestone, and per-workspace scoping made
  the same placement appear and vanish as the admin switched workspaces. Safe because the route is
  admin-only and admins already read platform-wide. Everything else on the payload (presence,
  workload, interns table) stays workspace-scoped. `LastPlacementCard` carries a help tooltip
  saying so, since a global number on an otherwise workspace-scoped board is surprising.
- **Workload segments are a fixed four** (`to do`, `in progress`, `on staging`, `blocked` —
  `WORKLOAD_SLUGS`, module-private to the service), so every table row has the same shape. Labels/colors come from the
  workspace's own `TicketStatus` rows and fall back to `statusService.DEFAULT_STATUSES`.
  `done`/`backlog` are excluded — the table is open work in flight. `Ticket.assignedTo` is an
  array, so a shared ticket counts once per assignee.
- **Composed from one new endpoint plus reuse**: `GET /api/admin/dashboard?workspaceId=`
  (**admin-only**; 400 on a malformed id, 404 on unknown/archived — it verifies the workspace
  exists because `assertWorkspaceAccess` short-circuits for admins without touching the DB, so a
  bogus id would otherwise return a convincing all-zeros payload). The standup card reuses
  `GET /api/dailies/admin/overview` and the picker reuses `GET /api/workspaces/all`.
- **Known gap — the standup card's denominator differs from the interns table.**
  `dailies/admin/overview` counts every active intern member, including `placed` ones, so a
  workspace can read "1 intern" in the table and "0 / 3 notes in" on the standup card. Fixing it
  means filtering `getWorkspaceDailyOverview`'s roster to in-programme interns, which also changes
  the existing Daily Insights page — deliberately left alone.
- **Not implemented, rendered as placeholders**: the *Specialization assigned* card is sample data
  (no specialization field, assigned-at timestamp, or assigning action exists in the model), and
  the *Write evaluation* / *Mark absence / excuse* quick actions are marked "Soon" — `Attendance`
  has no write path for absence at all (absence is the lack of a check-in, and only interns may
  check in). Both are flagged in-place in the components.

## Glossary

Domain terms used throughout the code. Get these right — especially the two "admin" meanings.

| Term | What it is |
|---|---|
| **Workspace** | Multi-tenant container. Scoping anchor for tickets, statuses, categories, comments, rooms. Every ticketing operation is constrained to one. |
| **Platform role** | User-level role: `admin`, `mentor`, `intern`, `leadership` (`server/constants/roles.js`). Drives login landing + route guards. |
| **Workspace-membership role** | Per-workspace `admin` / `member`, **independent** of platform role. Controls workspace management actions. ⚠️ A platform `admin` and a workspace `admin` are *not* the same thing — don't conflate them in authz. |
| **Hub** | Physical office location (`name`, `city`, `country`) — e.g. Sarajevo, Belgrade, Skopje, Medellín. Reference data. A user belongs to a hub. |
| **InternshipType** | The programme track an intern is on — reference data keyed by `slug`. E.g. `fep`, `shadow`. |
| **FEP** | **Future Experts Program** — the standard internship track (`slug: 'fep'`). Common in seed data and intern emails (`intern.active.fep@…`). |
| **Position** | A target job role (`slug` + `name`) an intern is training toward — e.g. QA, Frontend. Reference data. |
| **Technology** | A tech skill (React, Node, …). Reference data; attached to intern profiles and readiness flags. |
| **Readiness flag** | Per-intern assessment of readiness for a specific **technology** or **position**, level `none \| learning \| ready`, recorded by a user (`ReadinessFlag`). Admin-only (view and set). Feeds placement decisions. |
| **Intern status** | Lifecycle of an `InternProfile`: `active → ready → placed → completed`, or `discontinued`. Changing it is admin-only, even for the intern's assigned mentor. |
| **Primary / secondary mentor** | An intern has a primary mentor and optionally a secondary; both gate mentor access (`server/helpers/internAccess.js`). |
| **Project** | A client engagement the firm is running (e.g. "Northwind billing platform" for client "Northwind Traders") — `title/client/description/tech tags/status`. Admin-managed reference data; a recommendation refs one. Not workspace-scoped. |
| **Attendance / check-in** | An intern's office check-in for one day (`Attendance` — one sparse doc per intern per acted-on day; present days stored, absent days derived). Check-in window: 07:00–11:00 office time, weekdays. Cancel unchecks the day; the intern can check in again until the window closes. Reported **per calendar month** (no cumulative all-time rate); stats always computed, never stored. |
| **Recommendation** | An admin's placement recommendation for an intern (candidate pipeline) — mentors have no access. Resolving one recommendation (including a `placed` outcome) never touches the intern's other recommendations — each is resolved individually. Setting the profile status to `placed` directly (via the intern update endpoint) still auto-closes any open recommendations as `not_placed`. Concurrent open recommendations across projects are allowed, but the UI greys out create when the profile is already `placed`/`completed`/`discontinued`, and warns before creating another while one is already open on a different project. Pipeline KPIs count distinct interns, not recommendation records. |
| **Ticket status** | **Per-workspace, customizable** — not a global enum. Statuses live in `TicketStatus`, validated via `statusValidation` / `statusSlugAliases`. |
| **Story points / time-in-status** | Ticket estimation field; time-in-status tracks how long a ticket sits in each status column. |
| **Invalidation scope** | Socket.IO room key (`user:` / `workspace:` / `workspace-tickets:` / `ticket:` / `workspace-dailies:`) that drives React Query cache invalidation. |
