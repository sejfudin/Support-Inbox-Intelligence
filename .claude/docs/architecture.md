# Architecture

Shape of the system as it stands. Feature history lives in `.scratch/<feature>/issues/`; the
decisions behind the load-bearing choices live in `docs/adr/`; domain vocabulary lives in
`CONTEXT.md`. This file says how the pieces fit — when a rule's *reasoning* matters, it is a
comment at the code it constrains, and this file points there rather than restating it.

## Two domains

1. **Programme management** — interns, mentors, evaluations, mentor comments, readiness flags,
   recommendations, staffing requests, leadership dashboards.
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
| Leadership | `/programme` | Read-oriented stakeholder view, plus the one leadership write path (staffing requests). No ticket/workspace workflow — redirected to `/programme`. |
| Intern | `/dashboard` or `/create-workspace` | Manages own profile; works on assigned tickets in their workspace. Reads — read-only, self only — their own evaluations (notes included), readiness and recommendations on `/my-progress`. |

**Two authorization layers** — do not conflate:
- **Platform role** (above) — `admin/mentor/intern/leadership`.
- **Workspace membership role** — `admin` / `member` — controls per-workspace management actions,
  independent of platform role. See `.claude/docs/security.md`.

## Data model (Mongoose, `server/models/`)

Core: `User`, `Workspace`, `Ticket`, `TicketStatus`, `Category`, `Comment`, `History`,
`Notification`, `RefreshToken`, `Integration`, `Daily`.
Programme: `InternProfile`, `Evaluation`, `MentorComment`, `ReadinessFlag`, `Recommendation`,
`Attendance`, `NonWorkingDay`, `Position`, `Project`, `Hub`, `Technology`, `InternshipType`,
`Invitation`, `StaffingRequest`.
AI: `AISummary`.

- Tickets, statuses, categories, comments all carry a `workspace` ref — the scoping anchor.
- Statuses are **per-workspace and customizable** (not a global enum). See `statusService` and
  `server/helpers/statusValidation.js` / `statusSlugAliases.js`.
- **A status's `slug` is its identity, and a rename must never change it.** `updateStatus` writes
  the label only; everything that refers to a status across time refers to it by slug. A caller
  that genuinely wants a new key passes `updates.slug`, which goes through the duplicate check and
  integration sync (`applyStatusSlugChange`). The consumers this protects, and the silent breakage
  regenerating the slug caused, are listed at `statusService.js#updateStatus`.
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
    `workspace-dailies:<id>`, `intern:all`, `staffing-news:all`.
  - `intern:all` and `staffing-news:all` are global (not workspace-scoped) — broadcast to every
    connected client via `broadcastToAll`, since there's no room to target.
- Frontend consumes via `src/context/SocketContext.jsx`, invalidating query keys on events.

## Integrations

- **Groq AI** (`server/services/groqAiClient.js` + `aiSummaryService`, `ticketDescriptionGenerationService`,
  `ticketMetadataSuggestionService`; prompts in `server/prompts/`). Optional — gated on env vars.
- **GitHub App** (`server/services/githubService.js`, `autoLinkService.js`) — webhook-driven PR
  linking. RS256 JWT; installation tokens encrypted at rest (`server/helpers/crypto.js`).
- **Supabase Storage** (`server/config/supabase.js`) — attachment images, workspace logos, intern CVs.
  Server throws on startup if Supabase env vars missing.

### CV technology auto-detection

Uploading a CV (`POST /interns/me/cv`) extracts the PDF text (`pdf-parse`, `helpers/pdfText.js`),
matches it against the canonical `Technology` catalog (deterministic keyword/alias matching,
`helpers/cvTechnologyMatcher.js`), and merges the hits into `InternProfile.selfTechnologies` — same
effect as a manual add, no `ReadinessFlag` created, so each reads "Not assessed" until a mentor
assesses it. Best-effort by design: an unreadable PDF adds nothing and never fails the upload.
See `services/internCvService.js#syncTechnologiesFromCv`.

- **A re-upload replaces the previous scan, it does not accumulate.** `selfTechnologies` mixes
  manual and scanned entries, so `InternProfile.cvTechnologies` records the subset the scan added
  (always a subset of `selfTechnologies`, stripped from responses in `formatProfile`).
  Reconciliation is pure — `helpers/cvTechnologySync.js#reconcileCvTechnologies`, covered by
  `cvTechnologySync.test.js`. Its four rules:
  - **Manual declarations are never removed** — only what a scan added is CV-owned.
    `updateSelfTechnologies` prunes `cvTechnologies` to what is still declared, so removing a
    CV-added technology by hand hands it back to the intern.
  - **A readable CV that matches nothing still clears the previous scan** — a real result, not a
    failure.
  - **An unreadable CV changes nothing.** Text we could not extract is not evidence a skill was
    dropped. Removal also leaves any existing `ReadinessFlag` alone.
  - Profiles that last uploaded before `cvTechnologies` existed add without removing on their first
    re-upload, then self-correct. No backfill is possible.
- **The catalog is the ceiling.** A skill with no `Technology` row is invisible to the scan however
  it is spelled, so a thin catalog reads as a broken scanner. Adding one takes three steps in the
  same change: `seeder/defaultTechnologies.js` (the entry), `helpers/cvTechnologyMatcher.js`
  (`TECHNOLOGY_ALIASES` — real-world spellings; version-suffixed forms like `html5`/`python3` need
  their own alias), and `npm run seed:technologies` to backfill existing databases.
  `cvTechnologyMatcher.test.js` fails if a seeded slug has no alias entry.

## Notifications

`Notification` (`server/models/Notification.js`) covers two domains on one model: ticketing
(`ticket_comment`/`ticket_assigned`/`ticket_mention` — `ticket`/`workspace` populated, `link`
empty) and the intern-programme domain (`recommendation_created`, `recommendation_status_changed`,
`recommendation_not_placed`, `intern_placed`, `evaluation_created`, `readiness_updated`, the four
`specialization_*` types, `intern_status_changed`, `intern_expected_end_date_changed`,
`intern_documentation_updated`, `daily_attendance_reminder`, `mentor_note_mention`,
`intern_request_from_leadership` — `internProfile` set when the event is about one specific intern
(null for a project-level staffing request), `ticket`/`workspace` null, `link` a frontend route the
bell's action button navigates to). Both domains push through the same
`sendToUser(..., 'new_notification', ...)` socket event and the same `user:<id>` invalidation
scope (`socket/invalidationScopes.js`) — no new scope key was needed for the intern domain. The
bell (`NavbarNotifications`) is mounted in both top-level shells — `SidebarLayout.jsx` (admin/
mentor/intern) and `SymphonyNav.jsx` (leadership, a separate layout) — so every role that can
receive a notification has somewhere to read it.

- **Ticketing** notifications live in `server/services/notificationService.js`
  (`notifyNewTicketComment`, `notifyTicketAssigned`, `notifyTicketMention`), `await`ed from
  `commentService.js` / `ticketService.js` inside a try/catch that only logs on failure.
- **Intern-programme** notifications live in `server/services/internNotificationService.js`, one
  function per event (see `.claude/docs/security.md` for the writes that must never notify, or
  must notify staff instead of the intern). Every exported function computes a deterministic
  title/body first, then attempts a best-effort Groq rewrite for warmer phrasing — a JSON
  `{"title","body"}` contract parsed via `groqAiClient.extractJsonObject` — the same contract style
  as `ticketPrompts.js`'s JSON-returning prompts. Any AI failure at all — unconfigured key,
  timeout, malformed output — silently falls back to the deterministic text; a notification is
  always created either way, since this must never be the thing that makes an admin/mentor/
  leadership action fail or wait.
- **Two recipient axes, two prompt builders** (`server/prompts/internNotificationPrompts.js`).
  Most events notify **the intern** about their own record — `buildProgrammeUpdatePrompt`, with a
  distinctly celebratory `buildPlacementCelebrationPrompt` for `intern_placed`. A couple notify
  **staff** (admin/mentor/leadership) about someone else's situation — `mentor_note_mention`,
  `intern_request_from_leadership` — which use `buildStaffUpdatePrompt` instead: reusing the
  intern-framed prompt for a staff recipient produced text like "your programme record was
  updated" for a recipient reading about someone *else's* record, which is actively confusing.
  Always match the builder to the recipient axis when adding a new event type.
- **Called fire-and-forget** (no `await`) from the mutation services that trigger them
  (`recommendationService.js`, `evaluationService.js`, `readinessFlagService.js`,
  `specializationService.js`, `internService.js`, `mentorCommentService.js`, `projectService.js`,
  and the scheduled `dailyReminderService.js`) — mirrors the existing non-awaited
  `historyService.logEvent(...)` call in `commentService.js`. Every exported function catches its
  own errors internally and never rejects, which is what makes the bare, unawaited call safe — an
  unhandled rejection from a non-awaited async call is a process-level risk, so the safety net has
  to live inside the module rather than at each call site.
- **Placement dedup is structural, not a runtime lock.** `intern_placed` can be triggered from two
  independent admin actions — a recommendation's outcome flipping to `placed`
  (`recommendationService.js#updateRecommendation`) or a direct lifecycle status write
  (`internService.js#updateInternProgramme`) — and each guards on its own "did the profile just
  transition into placed" snapshot taken before the write, so it fires at most once per real
  transition and never on a no-op re-save (e.g. nudging an already-placed recommendation's start
  date). The two paths can't both fire for the same request.
- **Scheduled reminder** (`server/services/dailyReminderService.js`): a 10:30 Europe/Sarajevo,
  weekday-only nudge — "check in" and/or "file today's standup" — for whichever of the two an
  intern hasn't done yet; nothing fires for one who's done both. Polled every 5 minutes via
  `setInterval` (started from `index.js` after `connectDB()`), gated by an in-memory
  `lastRunDateKey` so the check body runs once per office day. No new dependency — reuses
  `attendanceTime.js`'s existing `Intl`-based, dependency-free timezone helpers (`officeHour`,
  `officeMinute`, `officeDateKey`, `isOfficeWeekend`) and skips `NonWorkingDay` entries. Attendance
  candidates mirror the roster `attendanceService.js#getRoster` already uses
  (`IN_PROGRAMME_STATUSES`, minus anyone exempt today); daily candidates mirror the roster
  `dailyService.js#getWorkspaceDailyOverview` already uses (`getActiveWorkspaceInterns`, per active
  workspace) — two different existing scoping rules, deliberately not unified into one.

## Recommendations (placement pipeline)

A recommendation is a mentor's placement proposal for an intern: a position + **project** (ref to
`Project`, admin-managed reference data — see below) + technologies, moving through a
**forward-only status lifecycle** with a separate placement outcome. Backend:
`server/{models/Recommendation.js, services/recommendationService.js,
controllers/recommendations.js, routes/recommendations.js}`. Frontend:
`components/interns/InternRecommendationsPanel.jsx` (data wiring + dialog state) over
`components/interns/recommendations/`.

**"In Selection"** is the user-facing name for the `recommended`/`interviewing` window (not yet
`resulted`) — used consistently across the leadership dashboard KPIs, Candidates filter and
Projects view. "Pipeline" survives only as the internal/doc term for the lifecycle as a whole
(this heading, `ACTIVE_PIPELINE_STATUSES`, `IN_PIPELINE_STAGE`); don't reintroduce it as UI copy.
See `CONTEXT.md`.

**Status lifecycle** — `recommended → interviewing → resulted`. Enforced server-side:

- A new recommendation always starts at `recommended` (create rejects anything else).
- `PATCH` rejects backward moves; the edit modal shows earlier stages locked. Setting a placement
  outcome forces status to `resulted`.
- **Interviewing can be skipped**: jumping `recommended → resulted` leaves interviewing dateless —
  rendered as a dashed "Skipped" step, distinct from "Pending" (not reached yet).

**Status dates** — `Recommendation.statusDates.{recommended,interviewing,resulted}` are the
authoritative, author-editable dates each stage was reached (each defaults to now when first
reached; may be backdated). Ordering is validated (`recommended ≤ interviewing ≤ resulted`) on the
server, on submit, and via date-picker `min`. The append-only `History` log (`entityType:
'recommendation'`, `statusKey`) remains the audit trail and the **fallback for records that predate
`statusDates`** — editing such a record seeds its dates from history first.

**Placement outcome** (`result.outcome`: `placed | not_placed`, note required) syncs the intern's
lifecycle status (`InternProfile.status`):

- `placed` → profile `placed`; `not_placed` → profile `ready` (back on the bench). Terminal states
  (`completed` / `discontinued`) are never touched.
- A recorded outcome can be changed but never removed.
- **`result.startDate`** (Date, optional) is the intern's **first day on the project** — often not
  the day the placement was decided. Prefilled with the Resulted date, editable afterwards in
  either direction; clearing it records "we don't know yet" rather than a guess. Deliberately
  **not** ordered against the stage dates: an intern may have started before anyone recorded the
  placement. It drives the attendance exemption (`InternProfile.placedAt`, see Attendance).
  Reversing the outcome clears it.
- **Delete recomputes from the most recent remaining recommendation**: newest is `placed` → stays
  `placed`, anything else (or none left) → `ready`. Deleting also removes the record's history
  trail; the confirm dialog warns when deleting the placement that marked the intern placed.
- **`result.demandEnded`** — set only by the staffing-request close-out cascade, never through this
  API. See `.claude/docs/staffing-requests.md`.

**Create guards** — the backend rejects create with 409 when the profile is
`placed`/`completed`/`discontinued`; the UI greys out **New recommendation** with a hover
explanation in those states. Concurrent open recommendations across projects remain allowed, but
creating a second while a `recommended`/`interviewing` one exists on a *different* project shows a
confirm dialog naming both projects.

**Roles** — admin-only for reads and writes (`assertReadAccess` /
`assertRecommendationWriteAccess`); `leadership` additionally has read access (fully read-only UI).
Mentors have no access at all, on the per-intern tab or the standalone `/recommendations` page.

## Staffing requests

Leadership records demand that arrived from outside the platform; admins answer it by putting interns
forward, which creates ordinary recommendations. The **only leadership write path** on the platform.

Its own doc: `.claude/docs/staffing-requests.md` — read it before touching staffing requests, the
put-forward flow, or the close-out cascade. The four load-bearing facts, so this file stands alone:

- **Not workspace-scoped** (`StaffingRequest`), the same exception as `Project`/`Recommendation`.
- **A staffing request holds no intern list.** Putting interns forward creates `Recommendation`
  records tagged with `staffingRequest`; who is on a project is always read off those
  (`docs/adr/0006`).
- **`closed` is terminal** — no reopen, no delete, no write of any kind to a closed request
  (`docs/adr/0005`). Closing resolves every candidate still in selection as `not_placed` with
  `result.demandEnded` (`docs/adr/0004`).
- **`helpers/staffingRequestRules.js` is the single authority** on what a user may do to a request.
  Services carry out its verdicts; screens never re-derive them.

Authorization lives in `.claude/docs/security.md`; vocabulary in `CONTEXT.md`.

## Specializations

An admin confirms **one of an intern's two declared positions** (`InternProfile.declaredPosition` /
`secondaryPosition`) as their focus, paired atomically with a dedicated 1-on-1 mentor. The mechanics
and the naming trap are in `CONTEXT.md` § "Specializations & positions" and
`docs/adr/0002-specialization-repurposes-secondary-mentor.md` — in short: marker is
`InternProfile.specializationAssignedAt` (set ⟹ `declaredPosition` IS the specialization, no
separate field), the mentor is the repurposed `InternProfile.secondaryMentor` (must differ from
`primaryMentor`), and confirming the secondary slot **swaps** the two positions.

Backend: `server/{helpers/specializationRules.js, services/specializationService.js,
controllers/specializations.js, routes/specializations.js}`. Frontend: `pages/SpecializationPage.jsx`
+ `components/interns/specialization/AssignSpecializationModal.jsx`. Not workspace-scoped — same
firm-global intern domain as Recommendations (see `.claude/docs/security.md`).

`specializationRules.js` is pure and holds every state transition (`applySpecialization`,
`reassignSpecialization`, `changeSpecializationMentor`, `clearSpecialization`,
`canInternEditDeclaredPosition`). The service loads, validates and persists. All routes admin-only:

| Route | Does |
|---|---|
| `POST /api/specializations` | Assign. Requires an existing `declaredPosition`; validates the mentor via `internProfileService#assertMentorUser` (active `admin`/`mentor`). |
| `GET /api/specializations` | The one filterable/paginated read backing the whole tab — `status` (`specialized` default \| `unspecialized` \| `all`), `mentorId`, `search`, `page`/`limit`. |
| `GET /api/specializations/candidates` | Every *un*specialized intern for the assign modal's picker, including ones with no declared position (shown disabled, not hidden). |
| `PATCH /:internUserId/reassign` | Correct to the intern's other position — swaps again; mentor and marker untouched. Throws if there is no secondary position. |
| `PATCH /:internUserId/mentor` | Re-pair with a different mentor; position and marker untouched. |
| `DELETE /:internUserId` | Clear. **No un-swap** — the position stays where the last assign/reassign left it. |

- `search` matches `User.fullname`/`email`, resolved to `user: { $in: ids }` before the profile query
  since `InternProfile` holds no searchable text itself. The list's `stats` (`specializedCount`,
  `totalCount`, plus `mentorLoad` when `mentorId` is set) are computed against the **whole** cohort
  independent of the active filters, so the header numbers stay stable while browsing views.
- Reassign / change-mentor / clear all load the profile first and 400 if `specializationAssignedAt`
  is not already set (`loadSpecializedProfile`) — nothing to manage on an unspecialized intern.
- **The lock**: while the marker is set the intern can't self-edit `declaredPosition`
  (`canInternEditDeclaredPosition`, enforced in `internService.js#updateSelfPosition`, 403). The
  secondary stays intern-editable and, via the existing "must differ from main" rule, automatically
  excludes whichever position the swap locked in.

### Project (reference entity)

`Project` (`server/models/Project.js`) is the canonical list of client engagements a recommendation
can point at (title, client, description, tech tags, `status`: `active | on_hold | completed`,
`type`: `client | internal`). Firm-global reference data, same pattern as `Technology`/`Position` —
**not** workspace-scoped despite the general "workspace-scope every resource" rule (that rule is the
ticketing domain's, not intern/recommendation reference data's).

- **Admin-only** create/edit (`requireRole(ROLES.ADMIN)`) — mentors can only select a project when
  writing a recommendation. Managed from the "Projects" tab on `/admin/platform-management`
  (`ReferenceDataProjectsPanel`).
- **`type`** is **required with no schema default**, so `projectService.createProject` rejects a
  missing or unknown value rather than letting a default absorb it. Purely descriptive today —
  it renders as a neutral badge and **nothing branches on it**. Stored slugs live in the model enum,
  display labels in `frontend/src/helpers/projects.js`, so relabelling never needs a migration; the
  value set is a provisional pair (see `CONTEXT.md`). Projects predating the field are typed by
  `npm run backfill:project-types` (idempotent) — run it right after deploying the schema change,
  since an unset `type` fails validation on any `save()`.
- Only `status: active` projects are offered in the recommendation form's picker; `on_hold` /
  `completed` stay on existing recommendations but drop out for new ones.
- A locked sentinel project (`slug: 'unspecified'`, `isSystem: true`) exists because
  `Recommendation.project` used to be free text; `seeder/migrateRecommendationProjects.js` repointed
  every pre-existing recommendation at it (old free-text values discarded, not preserved). It can't
  be edited or deleted and never appears in the picker.
- **"Which interns are on project X" is a derived read** (query `Recommendation` by `project`), not
  a stored roster — there is no members/roster field by design.
- **Leadership-facing Projects page** (`/projects`, `/projects/:id`) reads two additive,
  leadership+admin aggregates built the same derived-read way: `GET /api/projects/overview` returns
  every non-system project annotated with `placedCount`/`inSelectionCount` plus page-level KPIs, and
  `GET /api/projects/:id/overview` returns one project's `placed`/`selection`/`history` by grouping
  that project's `Recommendation` rows. No new schema. `GET /api/projects/:id` (any authenticated
  role) fills the gap the list route left. All three respond `{ success, message, data }`; the
  original three routes (list/create/update) keep their pre-existing raw-JSON shape untouched.
  The list page's "only projects with someone placed or in selection" default is a **client-side
  view filter** over the same payload — the endpoint and every KPI still cover every non-system
  project, so `kpis.totalProjects` keeps agreeing with `GET /api/projects`. KPI cards clear that
  filter when clicked, since their numbers count unstaffed projects too. Read-only for leadership.

## Attendance (office check-in)

Interns check in once per office day; admins get a read-only roster with a per-intern calendar
modal. Backend: `server/{models/Attendance.js, services/attendanceService.js,
controllers/attendance.js, routes/attendance.js}` + `helpers/{attendanceTime,attendanceStats}.js`.
Frontend: `pages/{MyAttendancePage,AttendanceOverviewPage}.jsx`, `components/attendance/*`,
`helpers/attendance.js`.

- **Sparse storage — one document per intern per acted-on day** (`Attendance`: `intern` →
  `InternProfile`, `date` as office-local `'YYYY-MM-DD'` string, `status: present | cancelled`,
  `checkedInAt`, `hub`, `checkInIp`). Absent days are **not** stored — absence is the lack of a
  record, derived at read time. A unique `{ intern, date }` index makes double check-ins idempotent
  (concurrent inserts race safely) and keeps a day to a single row.
- **Cancel unchecks the day, it does not lock it**: the record flips to `cancelled` (not deleted) and
  reads as absent, but `checkIn()` flips that same row back to `present` for as long as the window is
  open — the window closing is the only thing that settles a day. A repeat check-in on an already
  `present` day is a no-op preserving the original `checkedInAt`. All app-level in
  `attendanceService.js`; nothing schema-level constrains the transitions.
- **Reporting is per calendar month, never cumulative** (no all-time rate). `presentDays` /
  `workingDays` (Mon–Fri) / `attendanceRate` are computed for one month at a time, clamped to
  `[max(monthStart, startDate), min(monthEnd, today, lastOwedDay)]` — so a mid-month joiner isn't
  penalised, the current month only counts elapsed days, and a placed intern stops accruing. Always
  computed from raw records, never stored, so they can't go stale (`computeMonthStats`, shared by the
  roster and the admin dashboard, unit-tested in `attendanceStats.test.js`).
- **The obligation ends when an intern goes onto a real project.** `InternProfile.placedAt` (Date,
  nullable) is their **first day on the project** and is **inclusive-from**: that day is already
  exempt, so the last owed day is `previousDayKey(placedAt)`. From `placedAt` on, days leave the
  denominator and render as `DAY_STATUS.EXEMPT` in their own amber — grey made them
  indistinguishable from a weekend, and blue is the remote-day colour. `checkIn()` is refused (422)
  so the exemption isn't merely cosmetic.
  - It mirrors the placement's **`result.startDate`** and nothing else (`placementExemptionDate`) —
    **not** `statusDates.resulted` (when the decision was recorded) and **not** `result.decidedAt`
    (when someone got around to clicking it). An intern placed today who starts in ten days owes
    attendance for those ten days. Re-derived on every result update, so moving the start date moves
    the exemption in either direction.
  - **A placement with no start date yet exempts nothing** (`placedAt` stays null): placed on paper,
    still owes attendance. Cleared when an outcome flips back to `not_placed`.
  - An intern with no recommendation at all is exempted by setting `placedAt` directly via
    `internService.updateInternProfile` — but for anyone who *has* a placement record that value is
    overwritten on the next update, so edit the start date instead.
  - **Distinct from `expectedEndDate`**, which is when the internship is expected to finish and
    drives placement-bench urgency. Do not conflate them.
- **`placedAt` is routinely in the future** now that a start date can be recorded ahead of time.
  Every "is this intern exempt?" check must compare against today rather than testing the field for
  truthiness — `isExemptToday(placedAt)` on the frontend, `isExemptOn(placedAt, dateKey)` on the
  server. `Boolean(placedAt)` is the easy mistake and it makes the UI disagree with the denominator.
- **`NonWorkingDay`** is the cohort-wide calendar of weekdays nobody owed — `{ date, label, kind }`
  where `kind` is `holiday | break | remote` (default `holiday`). `kind` is **presentation only**:
  every kind leaves the denominator identically and nothing in the maths branches on it. It exists so
  the calendar can colour a remote week against a holiday, which the free-text `label` can't be
  relied on to do. **Cohort-wide only** — per-intern days off need their own model with a requester
  and an approval state; widening `kind` for them would exempt the whole cohort for one person's day.
- **`attendanceRate` is `null`, never `0`, when nothing was owed** (`workingDays === 0`: a placed
  intern, or a month before the start date). "No obligation" and "attended nothing" are different
  facts, and a fabricated `0%` reads exactly like a real one. Every consumer must handle null —
  render `—` (`formatAttendanceRate` / `hasAttendanceRate`), exclude it from averages
  (`averageAttendanceRate` skips nulls), and sort it last, not as zero.
- **Check-in window** (`attendanceTime.js`): 07:00–11:00 `Europe/Sarajevo` on weekdays. The server is
  authoritative; the client mirrors the rule for UX only.
- Endpoints — `GET /api/attendance/me` (full history for the calendar/streak + a current-month stat
  block) and `POST|DELETE /api/attendance/me/check-in` are intern-self. `GET /api/attendance` is the
  **admin-only** roster (`?month=&search=&hub=`, current month by default, records scoped to that
  month so the payload stays bounded) and covers only `active`/`ready` interns
  (`IN_PROGRAMME_STATUSES`) — a `placed`/`completed`/`discontinued` intern drops off entirely.
  `GET /api/attendance/:internProfileId` is **admin-only**, one intern's full history for the
  calendar modal, no status filter.
- The office-network **IP allowlist** guard (per-hub CIDR + `trust proxy`) is a deferred, optional
  step — `Attendance.checkInIp` is already captured for it.

## Admin dashboard (workspace-scoped)

The admin landing board: one workspace at a time — the caller's **active** workspace. Backend:
`server/{services/adminDashboardService.js, controllers/adminDashboard.js}` + `GET /dashboard` in
`routes/admin.js`. Frontend: `pages/AdminDashboardPage.jsx`, `components/admin/dashboard/*`.

- **`/dashboard` is role-split three ways**, not separate routes: `DashboardRoute` in
  `routes/AppRoutes.jsx` renders `AdminDashboardPage` for admins, `InternDashboardPage` for interns,
  and `UserDashboard` (assigned tickets) for mentors. It sits **outside `WorkspaceGuard`** so neither
  an admin nor an intern without an active workspace is redirected to `/create-workspace` — each
  board explains the state instead. The guard's redirects are repeated inside `DashboardRoute` for
  the mentor branch only. **Don't widen `WorkspaceGuard` instead**: `/tickets`, `/dailies` and
  `/analytics` all assume a resolved `user.workspaceId`.
- **The page has no workspace picker of its own** — it reads `user.workspaceId`; switching is the
  sidebar's `WorkspaceSwitcher`, which already `refetchUser()`s and navigates to `/dashboard`, so the
  board re-keys and refetches by itself. The switcher lists only workspaces the caller is a *member*
  of and collapses to a static "Global admin mode" label when an admin has no active workspace —
  which is why the empty state points at `/admin/workspaces` rather than the sidebar.
- **Scoping goes through `Workspace.members`, never `User.workspaceId`**
  (`helpers/workspaceInterns.js#getActiveWorkspaceInterns`, also used by `dailyService`).
  `InternProfile` has **no** `workspace` field, and `User.workspaceId` is only the member's
  *currently active* workspace, so scoping on it would drop interns who belong here but are switched
  elsewhere.
- **Presence and the workload table count only in-programme interns**
  (`InternProfile.IN_PROGRAMME_STATUSES` — `active`/`ready`, the same list the attendance roster
  filters on): a placed or discontinued intern has no live workload or attendance to report.
- **Placement and specialization cards are platform-wide, and they are the only global things on the
  page.** "Last intern placed", "Recent placements" and the *Specialization assigned* half query
  across the whole platform, unscoped — these are programme-level milestones on the intern's profile,
  and per-workspace scoping made the same row appear and vanish as the admin switched workspaces.
  Safe because the route is admin-only. `LastPlacementCard` carries a help tooltip saying so, since a
  global number on an otherwise workspace-scoped board is surprising. The specialization half reads
  `specializationAssignedAt` as the marker (never `secondaryMentor` alone — ADR-0002). Everything
  else on the payload stays workspace-scoped.
- **Workload segments are a fixed four** (`to do`, `in progress`, `on staging`, `blocked` —
  `WORKLOAD_SLUGS`, module-private to the service), so every table row has the same shape.
  Labels/colors come from the workspace's own `TicketStatus` rows, falling back to
  `statusService.DEFAULT_STATUSES`. `done`/`backlog` are excluded — the table is open work in flight.
  `Ticket.assignedTo` is an array, so a shared ticket counts once per assignee.
- **Composed from one new endpoint plus reuse**: `GET /api/admin/dashboard?workspaceId=`
  (**admin-only**; 400 on a malformed id, 404 on unknown/archived — it verifies the workspace exists
  because `assertWorkspaceAccess` short-circuits for admins without touching the DB, so a bogus id
  would otherwise return a convincing all-zeros payload). The standup card reuses
  `GET /api/dailies/admin/overview`; the intern picker behind the quick actions reuses
  `GET /api/interns`.
- **Known gap — the standup card's denominator differs from the interns table.**
  `dailies/admin/overview` counts every active intern member, including `placed` ones, so a workspace
  can read "1 intern" in the table and "0 / 3 notes in" on the standup card. Fixing it means
  filtering `getWorkspaceDailyOverview`'s roster to in-programme interns, which also changes the
  existing Daily Insights page — deliberately left alone.
- **Not implemented**: the *Mark absence / excuse* quick action is a "Soon" placeholder — `Attendance`
  has no write path for absence at all (absence is the lack of a check-in, and only interns check in).

## Intern dashboard (self-scoped)

The intern's landing board. Backend: `server/{services/internDashboardService.js,
controllers/internDashboard.js}` + `GET /me` in `routes/dashboard.js`. Frontend:
`pages/InternDashboardPage.jsx`, `components/intern/dashboard/*`.

- **`GET /api/dashboard/me` takes no parameters, ever.** Intern-only, read-only, and the subject is
  always `req.user` — there is deliberately no `?workspaceId=` / `?internId=` override like the admin
  board has, because this payload carries the caller's own recommendations and evaluations. That is
  the whole security model; see `.claude/docs/security.md`.
- **Attendance is NOT on the aggregate.** The hero reads `GET /api/attendance/me`, which already
  returns the full record history its streak and week strip derive from and is the cache the check-in
  mutation seeds and invalidates. Folding it in would give the hero two sources that disagree for a
  frame after checking in.
- **Interns read their own recommendations and evaluations** through
  `recommendationService.listOwnRecommendations` / `evaluationService.listOwnEvaluations` — narrow
  self-only reads, separate from the admin list functions, returning **redacted** shapes that pick
  fields explicitly rather than deleting them. Withheld: `recommendationNote`,
  `interviews[].feedback`, `result.note`. Evaluation `notes` are now shown (see "My Progress"
  below); this card does not render them, but the payload carries them.
  See `.claude/docs/security.md`.
- **The "My Selection Process" card shows one recommendation at a time, out of all of them.**
  `loadPipeline` returns `current` (newest by `updatedAt`), `items` (the whole redacted list — same
  `formatOwnRecommendation` shapes, so nothing extra rides along) and `total`. The card renders a
  `‹ n/N ›` switcher when `items.length > 1` and clamps its index, because a recommendation resolving
  reorders the list underneath it. The interview line shows the **soonest upcoming** interview,
  falling back to the most recent past one labelled as past — stored order is not chronological.
- **Ticket ordering lives in `server/helpers/ticketUrgency.js`**, extracted and unit-tested because
  the board's "start here" card is chosen entirely by it. Weights are additive, not a first-match
  ladder, so a blocked *critical* ticket outranks a blocked *low* one; `OVERDUE` has to clear the sum
  of every other weight, and the suite pins that.
- **Workload reuses the admin board's four segments** (`WORKLOAD_SLUGS`, kept in sync between the two
  services) with the workspace's own `TicketStatus` colours.
- **The full ticket list is `/tickets?assignee=me`**, not a second page, and one status of it is
  `/tickets?assignee=me&tab=<status-slug>`. `TicketPage` seeds its assignee filter from that param
  (`me` resolves against the signed-in user, so the link carries no id) and writes it back, so the
  filter survives a refresh and the URL stays shareable. The seed runs **once**, guarded by a ref —
  re-applying it would make clearing the "Assigned: …" chip snap straight back, because the
  write-back rewrites the param the seed reads.
  Every workload segment links to the filtered form through
  `components/intern/dashboard/workloadLink.js`, which encodes the slug the way `TicketPage`'s
  `decodeTabParam` expects (spaces become underscores, since slugs are space-separated). An unknown
  `tab` falls back to `all` via `allowedTabKeys`. Note the destination's tab counts are
  workspace-wide while the card's are the caller's own, so the two numbers legitimately differ.
- **Standup notes over `SUMMARY_MIN_CHARS` are shown AI-summarised**, expandable to the full text.
  `POST /api/dashboard/me/standup-summary` (intern-only, parameterless) →
  `services/standupSummaryService.js` → Groq, via its own prompt in `prompts/standupPrompts.js`.
  That prompt only *condenses*; do not merge it with `ticketPrompts.buildUserSummaryPrompt`, which
  deliberately writes an appraisal.
  - **The summary is cached on the `Daily` entry itself** (`entries[].aiSummary` — text,
    `sourceHash`, `generatedAt`), not in its own collection: it is derived from exactly that text,
    read only alongside it, and deleted with it.
  - **`sourceHash` is the freshness rule** — it digests the lines the summary came from, so editing
    the note stops the hash matching and the summary is treated as absent rather than shown stale.
    Both the read path and the generate endpoint go through `helpers/standupNote.js`, so they cannot
    disagree about which notes qualify or whether a cached summary still applies.
  - The card fires the mutation itself when the server sets `needsSummary`, guarded by a ref so a
    failed generation retries at most once per note per mount rather than hammering the provider.
  - **The note is the default view; the summary is a toggle, not a replacement.** Both are cut to
    hard per-section character caps and **nothing expands in place** — this card is one of three
    across a row, so its height *is* the row's height. "View full note" navigates to
    `/dailies?date=YYYY-MM-DD` instead.
- **`/dailies` accepts `?date=YYYY-MM-DD`**, seeding and syncing `selectedDate` (today carries no
  param). Parsed at noon so the day cannot slide in a timezone behind UTC.
- **Shared with the admin board**: `components/dashboard/{DashboardCard, DashboardHeader,
  WorkloadSegments, AttendanceMeter}` and the `.dashboard-hero-surface` gradient (whose theme-accent
  and contrast constraints are documented at the rule in `frontend/src/index.css`).
- **Not implemented**: weekly hours on the hero (`Attendance` records a check-in and no check-out, so
  hours aren't derivable — the line shows the month's attendance rate and present days instead), and
  the "next review in N days" line on evaluations (no scheduled-review concept exists in the model).

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

Platform-wide reference terms. Terms resolved during feature design live in `CONTEXT.md` — check
there first for anything in the dailies, projects, specializations, staffing-request or placement
vocabulary. Get the two "admin" meanings right.

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
| **Primary / secondary mentor** | An intern has a primary mentor and optionally a secondary; both gate mentor access (`server/helpers/internAccess.js`). The secondary is now *only* the specialization mentor — see ADR-0002. |
| **Project** | A client engagement the firm is running — `title/client/description/tech tags/status/type`. Admin-managed reference data; a recommendation refs one. Not workspace-scoped. |
| **Attendance / check-in** | An intern's office check-in for one day (`Attendance` — one sparse doc per intern per acted-on day; present days stored, absent days derived). Window 07:00–11:00 office time, weekdays. Reported **per calendar month**; stats always computed, never stored. |
| **Recommendation** | An admin's placement proposal for an intern on a `Project`, moving `recommended → interviewing → resulted` with a separate `placed`/`not_placed` outcome. Mentors have no access. Each is resolved individually — resolving one never touches the intern's others. Pipeline KPIs count distinct interns, not recommendation records. |
| **Staffing request** | Leadership's record of demand from outside the platform: a project needing N interns placed on it. Demand only — who is on a project is read off the recommendations tagged to it. |
| **Ticket status** | **Per-workspace, customizable** — not a global enum. Statuses live in `TicketStatus`, validated via `statusValidation` / `statusSlugAliases`. A status's `slug` is its identity; a rename changes the label only. |
| **Story points / time-in-status** | Ticket estimation field; time-in-status tracks how long a ticket sits in each status column. |
| **Invalidation scope** | Socket.IO room key (`user:` / `workspace:` / `workspace-tickets:` / `ticket:` / `workspace-dailies:` / `intern:all` / `staffing-news:all`) that drives React Query cache invalidation. |
