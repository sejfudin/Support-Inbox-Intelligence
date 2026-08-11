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
| Intern | `/dashboard` or `/create-workspace` | Manages own profile; works on assigned tickets in their workspace. Reads — read-only, self only — their own evaluations (notes included), readiness and recommendations on `/my-progress`. |

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
- **A status's `slug` is its identity, and a rename must never change it.** `updateStatus` writes the
  label only. Everything that refers to a status across time refers to it by slug: the dashboards'
  `WORKLOAD_SLUGS` segments, `statusSlugAliases`, `DEFAULT_STATUSES`, the integration targets, and any
  saved link carrying a `tab=`. Regenerating the slug on rename broke all of them silently — renaming
  "To do" matched no `WORKLOAD_SLUGS` entry, so both dashboards fell back to the *default* label with
  a null `statusId` and rendered a phantom "To do" column at 0 while the real tickets sat under the
  new name, uncounted. A caller that genuinely wants a new key passes `updates.slug`, which goes
  through the same duplicate check and integration sync (`applyStatusSlugChange`).
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
- **`result.startDate`** (Date, optional) is the intern's **first day on the project** — often not
  the day the placement was decided. The form prefills it with the Resulted date and it can be
  edited afterwards, forwards or backwards, as often as the date slips; clearing it records "we
  don't know yet" rather than a guess. Deliberately **not** ordered against the stage dates: an
  intern may have started before anyone recorded the placement. It drives the attendance
  exemption — see `InternProfile.placedAt` under Attendance. Reversing the outcome clears it.
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

## Specializations

An admin confirms **one of an intern's two declared positions** (`InternProfile.declaredPosition`
/ `secondaryPosition`, from ticket 03's self-service picker) as their focus, paired atomically with
a dedicated 1-on-1 mentor. See `docs/adr/0002-specialization-repurposes-secondary-mentor.md`
and `CONTEXT.md` for the full domain writeup (mechanics, naming trap). Backend:
`server/{helpers/specializationRules.js, services/specializationService.js,
controllers/specializations.js, routes/specializations.js}`. Frontend: `pages/SpecializationPage.jsx`
+ `components/interns/specialization/AssignSpecializationModal.jsx`.

- **Marker**: `InternProfile.specializationAssignedAt` (Date, nullable). Set ⟹ `declaredPosition`
  IS the specialization; there is no separate "which position" field.
- **Mentor**: stored in the existing `InternProfile.secondaryMentor` — repurposed by ADR-0002 to
  mean *only* the specialization mentor (invite-time write path removed in ticket 02). Must differ
  from `primaryMentor`.
- **Swap rule** (`server/helpers/specializationRules.js#applySpecialization`, pure, no I/O):
  confirming the `secondary` slot swaps it into `declaredPosition` and the old main drops to
  `secondaryPosition`; confirming `main` is a no-op swap. The pre-swap "which was main" is not
  retained.
- **Lock**: while `specializationAssignedAt` is set, the intern can't self-edit `declaredPosition`
  (`canInternEditDeclaredPosition`, enforced in `internService.js#updateSelfPosition`, 403 on
  violation). The secondary position stays intern-editable and — via the existing "must differ
  from main" rule in `updateSelfSecondaryPosition` — automatically excludes whichever position the
  swap just locked into `declaredPosition`.
- **Assign** (`POST /api/specializations`, admin-only): loads the intern profile, requires a
  `declaredPosition` already exists, validates the mentor (`internProfileService#assertMentorUser`
  — active `admin`/`mentor` user), runs `applySpecialization`, persists, emits
  `emitInternDataChanged()`.
- **List** (`GET /api/specializations`, admin-only): a single filterable/paginated read backing the
  whole tab — `status` (`specialized` default | `unspecialized` | `all`), `mentorId`, `search`
  (matches `User.fullname`/`email`, resolved to `user: { $in: ids }` before the profile query since
  `InternProfile` itself holds no searchable text), `page`/`limit`. Response includes `stats`
  (`specializedCount`, `totalCount`, and `mentorLoad` when `mentorId` is set) computed against the
  *whole* cohort, independent of the active filters, so the header numbers stay stable while
  browsing different views.
- **Candidates** (`GET /api/specializations/candidates`, admin-only): every *un*specialized intern,
  including ones with no declared position yet (shown disabled in the assign modal rather than
  hidden). Used only by the assign modal's intern picker, not by the tab's table (that goes through
  the general list above with `status=unspecialized`).
- **Reassign** (`PATCH /api/specializations/:internUserId/reassign`, admin-only): correcting an
  already-assigned specialization to the intern's other position —
  `specializationRules#reassignSpecialization` swaps `declaredPosition`/`secondaryPosition` again;
  mentor and `specializationAssignedAt` are untouched (it's a correction, not a new assignment).
  Throws if the intern has no secondary position (row-menu action is disabled/hidden client-side in
  that case too).
- **Change mentor** (`PATCH /api/specializations/:internUserId/mentor`, admin-only): re-pairs an
  already-specialized intern with a different mentor — `specializationRules#changeSpecializationMentor`
  sets `secondaryMentor` only (still validated via `assertMentorUser` + must differ from
  `primaryMentor`). Position and `specializationAssignedAt` are untouched.
- **Clear** (`DELETE /api/specializations/:internUserId`, admin-only):
  `specializationRules#clearSpecialization` — nulls `secondaryMentor` and
  `specializationAssignedAt`. **No un-swap**: whichever position `applySpecialization`/
  `reassignSpecialization` last left in `declaredPosition` stays there; only `assign`/`reassign` can
  move it again.
- Reassign/change-mentor/clear all first load the profile and 400 if
  `specializationAssignedAt` is not already set (`loadSpecializedProfile` in
  `specializationService.js`) — nothing to manage on an unspecialized intern.
- Not workspace-scoped — same firm-global intern domain as Recommendations (see
  `.claude/docs/security.md`).

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
- **Leadership-facing Projects page** (`/projects`, `/projects/:id` — `frontend/src/pages/fep/
  LeadershipProjectsPage.jsx` / `LeadershipProjectPage.jsx`) reads two additive, leadership+admin
  aggregate endpoints built the same derived-read way: `GET /api/projects/overview`
  (`projectService.getProjectsOverview`) returns every non-system project annotated with
  `placedCount`/`inSelectionCount` plus page-level KPIs (status breakdown, technology demand,
  skills in selection), and `GET /api/projects/:id/overview` (`getProjectOverview`) returns one
  project's `placed`/`selection`/`history`, each computed by grouping that project's
  `Recommendation` rows — no new schema, same pattern as the per-intern recommendations tab.
  The list page defaults to showing only projects with someone placed or in selection, but that's
  a **client-side view filter** over the same payload (like its status/technology filters) — the
  endpoint and every KPI still cover every non-system project, so `kpis.totalProjects` keeps
  agreeing with `GET /api/projects`. The KPI cards clear that filter when clicked, since the
  numbers on them count unstaffed projects too.
  `GET /api/projects/:id` (any authenticated role, mirrors the existing `GET /api/projects`) fills
  the one gap the existing list route had: no single-project fetch. All three new routes respond
  `{ success, message, data }` (the documented convention); the original three project routes
  (list/create/update) keep their pre-existing raw-JSON shape untouched. The page is read-only for
  leadership — no recommend/edit affordances — same as its existing read access to
  `Recommendation` data.

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
  `[max(monthStart, startDate), min(monthEnd, today, lastOwedDay)]` — so a mid-month joiner isn't
  penalised, the current month only counts elapsed days, and a placed intern stops accruing. Always
  computed from raw records, never stored, so they can't go stale (`computeMonthStats` in
  `server/helpers/attendanceStats.js` — shared by the roster and the admin dashboard; unit-tested in
  `attendanceStats.test.js`).
- **The attendance obligation ends when an intern goes onto a real project** — `InternProfile.placedAt`
  (Date, nullable) is their **first day on the project** and is **inclusive-from**: that day is
  already exempt, so the last owed day is `previousDayKey(placedAt)`. From `placedAt` on, days leave
  the denominator and render in their own amber (`DAY_STATUS.EXEMPT`) rather than as absences —
  a colour rather than grey because grey made them indistinguishable from a weekend or a holiday;
  amber rather than blue because blue is the remote-day colour (see `NonWorkingDay.kind`), and
  `checkIn()` is refused (422) so the exemption isn't merely cosmetic. Mirrors the placement's
  **`result.startDate`** and nothing else (`placementExemptionDate` in `attendanceStats.js`) —
  **not** `statusDates.resulted` (when the decision was recorded) and **not** `result.decidedAt`
  (when someone got around to clicking it). An intern placed today who starts in ten days is on
  the programme for those ten days and owes attendance for every one of them. Re-derived on every
  result update, so moving the start date moves the exemption with it, in either direction.
  **A placement with no start date yet exempts nothing** (`placedAt` stays null): placed on paper,
  still owes attendance. An intern with no recommendation at all is exempted by setting `placedAt`
  directly via `internService.updateInternProfile` — but for anyone who *has* a placement record
  that value is overwritten on the next update, so edit the start date instead. Cleared when an
  outcome flips back to `not_placed`.
  **Distinct from `expectedEndDate`**, which is when the internship is *expected* to finish and
  drives placement-bench urgency — do not conflate them.
- **`placedAt` is routinely in the future** now that a start date can be recorded ahead of time.
  Every "is this intern exempt?" check must therefore compare against today rather than testing
  the field for truthiness — `isExemptToday(placedAt)` on the frontend (`helpers/attendance.js`),
  `isExemptOn(placedAt, dateKey)` on the server. `Boolean(placedAt)` is the easy mistake and it
  makes the UI disagree with the denominator.
- **`NonWorkingDay`** is the cohort-wide calendar of weekdays nobody owed — `{ date, label, kind }`
  where `kind` is `holiday | break | remote` (default `holiday`). `kind` is **presentation only**:
  every kind leaves the denominator identically, and nothing in the maths branches on it. It exists
  so the calendar can colour a remote week blue against a holiday's grey, which the free-text
  `label` can't be relied on to do. **Cohort-wide only** — per-intern days off (an intern requesting
  remote, calling in sick, taking leave) need their own per-intern model with a requester and an
  approval state; widening `kind` for them would exempt the whole cohort for one person's day.
- **`attendanceRate` is `null`, never `0`, when nothing was owed** (`workingDays === 0`: a placed
  intern, or a month before the start date). "No obligation" and "attended nothing" are different
  facts, and a fabricated `0%` reads exactly like a real one. Every consumer must handle null —
  render `—` (`formatAttendanceRate` / `hasAttendanceRate` in `frontend/src/helpers/attendance.js`),
  exclude it from averages (`averageAttendanceRate` skips nulls), and sort it last, not as zero.
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

- **`/dashboard` is role-split three ways**, not separate routes: `DashboardRoute` in
  `routes/AppRoutes.jsx` renders `AdminDashboardPage` for admins, `InternDashboardPage` for
  interns (see below), and `UserDashboard` (assigned tickets) for mentors — `UserDashboard` is now
  the mentor branch only. It sits **outside
  `WorkspaceGuard`** so neither an admin nor an intern without an active workspace is redirected to
  `/create-workspace` — each board explains the state instead. The guard's redirects are repeated
  inside `DashboardRoute` for the mentor branch only. Don't widen `WorkspaceGuard` instead:
  `/tickets`, `/dailies` and `/analytics` all assume a resolved `user.workspaceId`.
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
  `GET /api/dailies/admin/overview`; the intern picker behind the recommend/evaluate quick actions
  reuses the platform-wide `GET /api/interns`.
- **Known gap — the standup card's denominator differs from the interns table.**
  `dailies/admin/overview` counts every active intern member, including `placed` ones, so a
  workspace can read "1 intern" in the table and "0 / 3 notes in" on the standup card. Fixing it
  means filtering `getWorkspaceDailyOverview`'s roster to in-programme interns, which also changes
  the existing Daily Insights page — deliberately left alone.
- **Platform-wide, not workspace-scoped**: both halves of the *Recent placements / Specialization
  assigned* card. Placement and specialization are programme-level milestones on the intern's
  profile rather than workspace events, and the endpoint is admin-only, so scoping them made the
  same row appear and disappear as the admin switched workspaces. The specialization half reads
  `specializationAssignedAt` as the marker (never `secondaryMentor` alone — see ADR 0002) and
  `declaredPosition` as the confirmed position. Everything else on the payload stays scoped.
- **Not implemented, rendered as a placeholder**: the *Mark absence / excuse* quick action is
  marked "Soon" — `Attendance` has no write path for absence at all (absence is the lack of a
  check-in, and only interns may check in). Flagged in-place in the component.

## Intern dashboard (self-scoped)

The intern's landing board. Backend:
`server/{services/internDashboardService.js, controllers/internDashboard.js}` +
`GET /me` in `routes/dashboard.js`. Frontend: `frontend/src/pages/InternDashboardPage.jsx`,
`components/intern/dashboard/*`, `api/internDashboard.js`, `queries/internDashboard.js`.

- **`GET /api/dashboard/me` takes no parameters, ever.** Intern-only, read-only, and the subject is
  always `req.user` — there is deliberately no `?workspaceId=` / `?internId=` override like the
  admin board has, because this payload carries the caller's own recommendations and evaluations.
  That is the whole security model; see `security.md`.
- **Attendance is NOT on the aggregate.** The hero reads `GET /api/attendance/me`, which already
  returns the full record history its streak and week strip are derived from and is the cache the
  check-in mutation seeds and invalidates. Folding it in would give the hero two sources that
  disagree for a frame after checking in.
- **Interns read their own recommendation and evaluations**, through
  `recommendationService.listOwnRecommendations` / `evaluationService.listOwnEvaluations` — narrow
  self-only reads, separate from the admin list functions, returning **redacted** shapes that pick
  fields explicitly rather than deleting them. Withheld: `recommendationNote`,
  `interviews[].feedback`, `result.note`. Evaluation `notes` are now shown (see "My Progress"
  below); this card does not render them, but the payload carries them. See `security.md`.
- **The pipeline card shows one recommendation at a time, out of all of them.** `loadPipeline`
  returns `current` (newest by `updatedAt`), `items` (the whole redacted list — same
  `formatOwnRecommendation` shapes, so nothing extra rides along) and `total`. The card renders a
  `‹ n/N ›` switcher when `items.length > 1` and clamps its index, because a recommendation resolving
  reorders the list underneath it. It used to return `current` only, so an intern put forward for more
  than one project could not reach the others at all.
  The interview line shows the **soonest upcoming** interview, falling back to the most recent past
  one labelled as past — stored order is not chronological, so taking the first dated record
  presented last week's interview as what comes next.
- **Ticket ordering lives in `server/helpers/ticketUrgency.js`**, extracted and unit-tested
  (`ticketUrgency.test.js`) because the board's "start here" card is chosen entirely by it. Weights
  are additive, not a first-match ladder, so a blocked *critical* ticket outranks a blocked *low*
  one; `OVERDUE` has to clear the sum of every other weight, and the suite pins that.
- **Workload reuses the admin board's four segments** (`WORKLOAD_SLUGS`, kept in sync between the
  two services) with the workspace's own `TicketStatus` colours. The card toggles between a
  proportional bar and a donut, remembered in `localStorage` via `hooks/useStoredPreference.js`
  (per browser profile, like the colour theme — not per account). The donut seats "In progress"
  and "On staging" across the ring from each other: the platform defaults put blue next to violet,
  which as *adjacent* arcs fail the CVD separation check.
- **Shared with the admin board**: `components/dashboard/{DashboardCard, DashboardHeader,
  WorkloadSegments, AttendanceMeter}` and the `.dashboard-hero-surface` gradient. That surface
  clamps the theme accent's lightness in OKLCH (with a `color-mix` fallback) so every theme's
  `--primary` — including Mono's near-white dark step — stays dark enough for the white hero text.
- **The full ticket list is `/tickets?assignee=me`**, not a second page, and one status of it is
  `/tickets?assignee=me&tab=<status-slug>`. `TicketPage` seeds its assignee filter from that param
  (`me` resolves against the signed-in user, so the link carries no id) and writes it back, so the
  filter survives a refresh and the URL stays shareable. The seed runs **once**, guarded by a ref —
  re-applying it would make clearing the "Assigned: …" chip snap straight back, because the
  write-back rewrites the param the seed reads.
  The board's "View all" uses the unfiltered form; **every workload segment links to the filtered
  one** — donut slices, bar segments and both views' legend rows all go through
  `components/intern/dashboard/workloadLink.js`, which encodes the slug the way `TicketPage`'s
  `decodeTabParam` expects (spaces become underscores, since slugs are space-separated). An unknown
  `tab` falls back to `all` via `allowedTabKeys`, so a segment for a status the workspace has since
  removed still lands somewhere sensible. Note the destination's tab counts are workspace-wide while
  the card's are the caller's own, so the two numbers legitimately differ.
- **The workload card has no card-wide stretched link.** It used to be a `<section>` with a stretched
  `absolute inset-0` anchor opening "all my tickets", which covered the whole panel and swallowed
  every click meant for a single status. The per-status links are the click targets now: legend rows
  are real `<a>`s (keyboard-reachable, openable in a new tab), and the bar segments duplicate them
  for the mouse only — `tabIndex={-1}` plus `aria-hidden`, so they add no second set of tab stops
  and no duplicate announcements. The view toggle and the donut keep `relative z-10`.
- **Standup notes over `SUMMARY_MIN_CHARS` are shown AI-summarised**, expandable to the full text.
  `POST /api/dashboard/me/standup-summary` (intern-only, parameterless) →
  `services/standupSummaryService.js` → Groq, via its own prompt in `prompts/standupPrompts.js`.
  That prompt only *condenses*; do not merge it with `ticketPrompts.buildUserSummaryPrompt`, which
  deliberately writes an appraisal.
  - **The summary is cached on the `Daily` entry itself** (`entries[].aiSummary` — text,
    `sourceHash`, `generatedAt`), not in its own collection: it is derived from exactly that text,
    read only alongside it, and deleted with it.
  - **`sourceHash` is the freshness rule.** It digests the done/todo/blocker lines the summary came
    from, so editing the note stops the hash matching and the summary is treated as absent rather
    than shown stale. Both the read path (`needsSummary` / `aiSummary` on the aggregate) and the
    generate endpoint go through `helpers/standupNote.js`, so they cannot disagree about which
    notes qualify or whether a cached summary still applies. Unit-tested in `standupNote.test.js`.
  - The card fires the mutation itself when the server sets `needsSummary`, guarded by a ref so a
    failed generation retries at most once per note per mount rather than hammering the provider.
  - **The note is the default view; the summary is a toggle, not a replacement.** Both are cut to
    hard character caps (`SECTION_CHAR_CAP` / `SUMMARY_CHAR_CAP`) and **nothing expands in place** —
    this card is one of three across a row, so its height *is* the row's height, and letting it
    grow pushed the attendance hero and workload card down. The cap is per section rather than one
    budget for the note, so a long "Done" can never crowd out "Blocked". "View full note" navigates
    to `/dailies?date=YYYY-MM-DD` instead of expanding.
- **`/dailies` accepts `?date=YYYY-MM-DD`**, seeding and syncing `selectedDate` (today carries no
  param). Parsed at noon so the day cannot slide in a timezone behind UTC.
- **Not implemented**: weekly hours on the hero (`Attendance` records a check-in and no check-out,
  so hours are not derivable — the average check-in time stood in for them briefly and was not
  worth the space, so the line shows the month's attendance rate and present days), and the "next
  review in N days" line on evaluations (no scheduled-review concept exists in the model).

## My Progress (intern self-scoped, read-only)

The intern's read-only mirror of everything the programme records **about** them, at
`/my-progress` — the dashboard cards show the headline, this page is the record. Backend:
`server/{services/internProgressService.js, controllers/internDashboard.js}` +
`GET /me/progress` in `routes/dashboard.js`, with the arithmetic in
`server/helpers/{evaluationTrend,readinessSummary}.js` (both unit-tested). Frontend:
`frontend/src/pages/MyProgressPage.jsx`, `components/intern/progress/*`,
`api/internProgress.js`, `queries/internProgress.js`.

- **`GET /api/dashboard/me/progress` takes no parameters, ever** — same rule and reason as
  `GET /api/dashboard/me`, and more load-bearing: this is the widest self-read on the platform. See
  `security.md`. Four sections in one payload (`programme`, `evaluations`, `readiness`,
  `recommendations`) so the page has one loading state and one cache key for the socket refresh to
  land on — four endpoints would refresh three sections and leave the fourth stale.
- **Nothing on it is workspace-scoped.** Every section is programme data, so unlike the dashboard
  aggregate there is no `resolveActiveWorkspaceId` call in the service and the route sits outside
  `WorkspaceGuard` — an intern between workspaces still has a review history.
- **Read-only is a property of the data, not a UI convention.** Evaluations
  (`evaluationService.createEvaluation`), readiness (`upsertReadinessFlag`) and recommendations
  (`requireRole(ADMIN)` on `/api/recommendations`) are all admin-authored; the service only reads
  and there is no mutation hook in the page's component tree.
- **Evaluation `notes` are shown here** — the reversal of a previously documented decision, with the
  reasoning on `formatOwnEvaluation` and in `security.md`. `MentorComment` stays invisible to
  interns and must not be folded in; it has its own `visibleTo` recipient list and its existing rows
  were written under an expectation of staying internal.
- **Readiness is a join, not a list of flags.** `helpers/readinessSummary.js` drives the rows from
  the intern's *declared* technologies and position, so a declared technology nobody has assessed
  gets a "Not assessed" row (that gap is the actionable part of the section) and a position flag
  left over from a previous role reads "Not assessed" rather than carrying a stale level forward —
  the same rules `InternReadinessPanel` / `InternRoleReadinessPanel` apply for the admin.
- **Only the newest evaluation carries movement chips**, computed server-side by
  `helpers/evaluationTrend.js` from the two newest periods — the comparison the chip claims to be. A
  `null` delta ("no earlier period") renders nothing; a `0` delta renders "Same", because held
  steady and never-measured are different facts.
- **Stage logic is shared with the dashboard card**, not copied:
  `frontend/src/helpers/recommendationStages.js` holds the stage vocabulary, the
  skipped-vs-pending rule and the "which interview comes next" pick, and both `MyPipelineCard` and
  the progress page's recommendation section import it. Still deliberately separate from the admin's
  `components/interns/recommendations/recommendationUi.jsx`, which carries that redesign's own
  hardcoded palette and font stack.
- **`emitInternDataChanged()` now fires on evaluation create and readiness upsert too** (it
  previously fired only from `internService`, `recommendationService` and `specializationService`).
  Without it an admin recording an evaluation left both this page and the dashboard's evaluations
  card stale indefinitely for an intern sitting on them. The frontend's `invalidateInternScope`
  refreshes `internProgressKeys.all` plus the `intern-readiness` / `intern-profile` keys that
  `/my-technologies` reads.
- **Attendance is deliberately not on it** — `/my-attendance` owns that surface and the dashboard
  hero already reads `GET /api/attendance/me`; a third copy of the same month's numbers is a third
  thing to keep in agreement. The programme panel links there instead.
- The lifecycle status is printed **verbatim** (no label mapping, per the rule in
  `frontend/src/helpers/internProfile.js`) with a plain-English sentence beside it from
  `components/intern/progress/programmeStatus.js`. Keep those as sentences: the moment one becomes a
  two-word noun it has turned into the label mapping the rest of the app avoids.

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
