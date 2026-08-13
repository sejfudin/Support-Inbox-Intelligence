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
| Intern | `/dashboard` or `/create-workspace` | Manages own profile; works on assigned tickets in their workspace. |

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
- **`result.demandEnded`** — set only by the staffing-request close-out cascade. See Staffing
  requests.

**Create guards** — the backend rejects create with 409 when the profile is
`placed`/`completed`/`discontinued`; the UI greys out **New recommendation** with a hover
explanation in those states. Concurrent open recommendations across projects remain allowed, but
creating a second while a `recommended`/`interviewing` one exists on a *different* project shows a
confirm dialog naming both projects.

**Roles** — admin-only for reads and writes (`assertReadAccess` /
`assertRecommendationWriteAccess`); `leadership` additionally has read access (fully read-only UI).
Mentors have no access at all, on the per-intern tab or the standalone `/recommendations` page.

## Staffing requests

Leadership records demand that arrived from outside the platform; admins answer it by putting
interns forward, which creates ordinary recommendations. `CONTEXT.md` § "Staffing requests" holds
the canonical terms (**staffing request**, **requested position**, **putting interns forward**,
**closing**, **closing out**); `.claude/docs/security.md` holds the per-route and per-close-reason
authorization, which is not restated here; `.scratch/staffing-requests/` holds the spec and the
implementation history.

**`StaffingRequest`** (`server/models/StaffingRequest.js`) — not workspace-scoped, matching
`Project` and `Recommendation`.

- Project identity is **at least one** of `project` (ref) or `draftProject` (embedded
  `name`/`client`/`description`), enforced in `pre('validate')`. `draftProject` is kept forever as
  evidence of what was originally asked for, so the two coexist once resolved.
- `requestedPositions` is an embedded array of `{ position, count, technologies[] }` with a path
  validator rejecting a repeated `position`. **A requested position is identified by
  `staffingRequest + position`** — there is no per-row id, so changing a position and removing one
  are the same event.
- `author`, optional `neededBy` (real `Date`, no free-text fallback).
- `status` is `open | closed`; closing sets `reason` (`fulfilled | declined | cancelled`),
  `closedBy`, `closedAt`, enforced together by `pre('validate')`.
- **`note` is the admin's remark on the request, not the author's ask** — one per request, written
  when the admin closes it, carrying `noteBy` + `noteAt` (a `pre('validate')` hook requires all
  three or none, since a half-written note would render unattributed). Leadership never authors it:
  create/update ignore `note` entirely. A cancellation's reason goes to the separate `closeNote`
  field precisely so cancelling cannot overwrite an admin's note.
- **`closed` is terminal: no reopen, no delete, no write of any kind to a closed request**
  (`docs/adr/0005`) — the close carries its own reason precisely because nothing can add one later.

**`helpers/staffingRequestRules.js`** is the single pure rules module for the feature (no I/O, no
clock — timestamps passed in), following `helpers/specializationRules.js` and unit-tested with
plain objects in `staffingRequestRules.test.js`. Services carry out its verdicts and never
re-derive them:

- `deriveProgress` — requested positions + tagged recommendations → per-position
  `{ wanted, putForward, inSelection, placed }` and totals. A tagged recommendation whose position
  isn't in the request is ignored rather than crashing. **`putForward` counts every tagged
  recommendation regardless of outcome; `inSelection` counts the ones not yet `resulted`. The two
  are not interchangeable and no screen may collapse them** (`docs/adr/0006`).
- `isDemandMet` — every requested position has `placed >= wanted`. A boolean and nothing more: it
  drives the admin's "close as fulfilled" prompt. **Nothing anywhere auto-closes.**
- `needsProject` / `assertCanResolveProject` — `needsProject(request)` is `!request.project`;
  `assertCanClose` calls it directly to refuse `fulfilled` while it holds, server-side rather than
  merely hidden in the UI. `assertCanResolveProject` refuses a request that already has a project,
  or is closed.
- `partitionPickerCandidates` — intern profiles + their recommendations → `excluded` (discontinued,
  completed, or already put forward for this requested position) / `warned` (already placed, or in
  selection on another project, flagged with which) / `clean`. Excluded interns are dropped by the
  service rather than returned; warned ones are shown and selectable.
- `assertCanPutForward` — admin only, request open, project resolved. The last is not cosmetic:
  `Recommendation.project` is a required reference.
- `assertCanClose` / `applyClose` — close legality in one sentence: **leadership withdraws, admin
  answers**. Also takes `inSelectionCount` and requires a `notPlacedReason` exactly when that is
  above zero. The per-reason permission split, which reasons demand a stated one, and the
  403-vs-400 mapping are all in `.claude/docs/security.md`. There is no `assertCanReopen`.
- `planStaffingRequestEdit(request, { requestedPositions, projectId }, recommendations)` — every
  legality question and consequence of an edit in one call, returning
  `{ endingPositionIds, closeOutCount, projectChanged, movingCount }`.
- `selectCloseOutRecommendations(recommendations, positionIds)` — which candidates a close (or an
  edit that drops demand) resolves: tagged, still in selection, for one of `positionIds`. Placed
  interns fall out for free, since a placement is already `resulted`. Position-scoped so the edit
  path reuses it for a single changed or removed position.
- `deriveUnreadStaffingRequestIds` — see News feed below.

**Formatted request payload** (`formatRequest` in `services/staffingRequestService.js`) — the one
place a request document becomes a response: adds `progress` (straight from `deriveProgress`) and
`suggestions`, one entry per tagged recommendation
(`{ id, position, internName, internProfile, startDate, technologies[], status, outcome }`), so the
UI can group suggested interns under the requested position they were put forward for. There is no
derived status field. **`position` stays a raw id on purpose** — `deriveProgress` matches it against
`requestedPositions` by id, so populating it would silently break every progress count.

**Tagging recommendations** — `Recommendation.staffingRequest` is a nullable ref set only when the
recommendation was created by putting an intern forward
(`recommendationService.createRecommendationsForStaffingRequest`); the position is forced to the one
it was created against (`docs/adr/0006`). `RECOMMENDATION_RESULTS` is untouched — an intern closed
out when the demand behind their process ends is still `not_placed`, with the difference carried by
`result.demandEnded` (`docs/adr/0004`).

**`Recommendation.result.demandEnded`** (Boolean, default `false`) — this `not_placed` was caused by
the demand ending, not by a decision about the intern. Written **only** by the cascade;
`applyResultPayload` ignores it on the way in, carries a stored `true` over while the record stays
`not_placed`, and drops it the moment the outcome changes. It is the one part of `result` besides the
outcome and dates that reaches the intern (`formatOwnRecommendation` still withholds `result.note`),
where it swaps "Not placed this time" for "This opportunity closed before a decision was made about
you". **Any future placed-vs-not-placed metric must exclude these.**

**Resolving a draft project** — `resolveStaffingRequestProject` (link an existing project) and
`resolveStaffingRequestProjectByCreating` (create one, then link), at `POST /:id/resolve-project` and
`POST /:id/resolve-project/create`. Both admin-only, checked directly in the service rather than
through the author-or-admin `assertWriteAccess` — leadership can describe a project, never create or
link one. `type`, `status` and `technologies` are never seeded from the request (leadership never
classifies a project); `name`/`client`/`description` are prefilled from `draftProject` on the client
only and stay editable. The create path returns `{ existingProject }` in a 409 on a `Project.slug`
collision rather than a raw `E11000`. Fuzzy name matching against the draft
(`frontend/src/helpers/projectMatch.js`, pure — the project list is already loaded) puts "possible
matches" ahead of "create new".

**Putting interns forward** — the feature's load-bearing write. Two admin-only routes, with
deliberately different shapes:

- `GET /:id/positions/:positionId/candidates` reads the picker for **one** requested position (the
  position is a path segment because an intern is offered for the discipline that was asked for,
  never out of one flat list), returning rows already partitioned by `partitionPickerCandidates`
  plus the position's technologies.
- `POST /:id/put-forward` is **request-level** and takes the whole staged cart in one body:
  `{ groups: [{ positionId, internProfileIds }] }`. The position is still never a free choice — it is
  the key of the group and must be one the request asked for.
  `createRecommendationsForStaffingRequest` `insertMany`s one recommendation per pick across every
  group in a single write, tagged with `staffingRequest`, logs each one's initial status event, and
  emits `emitInternDataChanged()`. The request itself is never written (`docs/adr/0006`).
- The picker rules are **re-checked server-side per group** (a cart goes stale while staged), and
  refusals come back **all-or-nothing** as `409` with
  `data.rejections = [{ positionId, internProfileId, reason }]`, so the client marks the offending
  rows rather than failing the whole form with one message.
- **One submit is one answer**: exactly one `staffing:put_forward` history event per submit, naming
  the total across every position, and exactly one leadership badge. Individual placements
  deliberately do not badge.

**Closing, and closing out its candidates** — `POST /:id/close` is the only thing that ends a
request, and it ends the whole thing: whatever the reason, every candidate still **in selection** is
resolved `not_placed` with `result.demandEnded` and one shared reason. Placed interns are never
touched. Both ADRs behind this are load-bearing: `docs/adr/0004` (the cascade, and why not
untag/delete/third-outcome) and `docs/adr/0005` (no reopen).

- Body is `{ reason, note?, notPlacedReason? }`. `notPlacedReason` is required exactly when at least
  one candidate is in selection, is written to every closed-out record's `result.note`, and has
  **no** per-intern variant — a person-specific reason is written on that person's recommendation,
  one at a time.
- The cascade is `recommendationService.closeOutRecommendationsForDemandEnd(user, {
  staffingRequestId, positionIds, reason, action })` — a reusable unit, called from both the close
  and the edit path. Per record it writes the result, stamps `statusDates.resulted`, and appends its
  own `recommendation` history row (shared with the placement auto-close via `resolveAsNotPlaced`);
  then it returns each intern to the ready bench (`status: 'ready'`, `placedAt: null`) **unless they
  hold a placement elsewhere**, and emits `emitInternDataChanged()`. It returns
  `{ closedOutCount }`, which the caller names in the trail.
- The cascade runs **after** the request is saved, so a failure leaves a closed request with a
  retryable close-out rather than a dozen resolved people on a still-open one.
- Nothing auto-closes. Demand met renders a "Close as fulfilled" button inside the existing blocker
  banner on the admin pane only (keyed off `blocker.key === 'demand-met'`); leadership never sees
  it, and keeps Cancel with no Reopen.

**Editing an open request** — `PATCH /:id` accepts `requestedPositions`, `neededBy`, `projectId` and
`draftProject` (never `note`), and carries out `planStaffingRequestEdit`'s verdict.

- **A position that stops being asked for closes out its candidates**, through the same cascade
  under the same mandatory `notPlacedReason`.
- **The one refusal: a position with someone `placed` against it**, as a 400 naming the intern
  ("Frontend can't be changed, Ana is already placed against it"). Lowering a `count` closes out
  nobody and may go below what is already placed — "1 wanted, 2 placed" is legal.
- **Changing the project moves every tagged recommendation with it** (`updateMany` +
  `emitInternDataChanged()`), with no refusal, including for placed interns: repointing only ever
  means the wrong project was named. Interview rows keep their own free-text `company`/`role`,
  deliberately un-rewritten. Naming the *first* project is still resolution (admin-only), so the
  edit path refuses it.
- `draftProject.name/client/description` stay editable **before and after** resolution — the trail
  records both versions, which protects the original ask better than freezing it did.
- **There is deliberately no project lock**: putting interns forward never freezes the project
  reference.
- Editing is **the author's alone** — route-gated to `LEADERSHIP` and narrowed to the author in
  `assertWriteAccess`, matching the leadership shell, the only screen that mounts the form.

**News feed** — both shells learn about staffing-request activity without a bell. Deliberately
doesn't use `Notification` (`docs/adr/0003`): the history log itself is the notification.

- `History.entityType` gains `'staffingRequest'`. Every event is appended via
  `historyService.logStaffingRequestEvent` with a **namespaced** `statusKey` (`staffing:filed`,
  `staffing:project_resolved`, `staffing:put_forward`, `staffing:closed`,
  `staffing:positions_changed`, `staffing:project_changed`, `staffing:draft_edited`,
  `staffing:edited`) — namespaced because `statusKey` is a string space shared with recommendation
  stage tracking, where bare `placed` already means something.
- Unlike every other history write, this one is **awaited and its errors surfaced** (see the comment
  at `staffingRequestService.createStaffingRequest`) — a lost row means leadership/admin silently
  never finds out, not just a missing log line.
- `User.staffingRequestsLastSeenAt` (Date, nullable) is the per-viewer read marker. Never opened ⟹
  `null` ⟹ every existing event counts as news, not zero.
- `deriveUnreadStaffingRequestIds` is pure: raw `{ entityId, userId, timestamp }` events plus
  `{ lastSeenAt, viewerId }` → the request ids with news. Excludes events the viewer caused; an event
  exactly at `lastSeenAt` does not count (must be strictly newer). `getStaffingRequestNews` runs
  fetched events through it rather than reimplementing the policy as a Mongo aggregation.
- Three reads: `GET /news` → `{ count, requestIds }`, `POST /seen`, and `GET /:id/history` (newest
  first, no populate — actor name comes from the denormalized `userName` on each row).
- New index `History.{ entityType: 1, timestamp: -1 }` — the existing
  `entityType, entityId, timestamp` is scoped to a single entity and can't answer "which entities of
  this type have an event newer than X".
- Socket key `staffing-news:all` — global like `intern:all`, fired on every staffing-request history
  write, handled on the client by invalidating the news query key. That is its only consumer, so no
  per-row query needs its own subscription.

**Frontend** — the two sides do not share a detail pane. Leadership:
`LeadershipRequestsPage.jsx` → `RequestDetail.jsx`, the only screen that mounts the edit form. Admin:
`pages/AdminStaffingRequestsPage.jsx` (`/admin/staffing-requests`, admin-only), list / detail / rail.
The per-position cards of both sides share their chrome through `RequestPositionCard.jsx`. Three
things about this layer are load-bearing rather than cosmetic:

- **Picks are staged client-side, never persisted server-side** (`hooks/useStagedPicks.js`, keyed
  `requestId → positionId → picks`, mirrored to `sessionStorage` so a refresh doesn't discard unsent
  work). A staged pick is an intention the server has never been told about, so nothing can be read
  back off it and no model holds it — changing that needs its own ADR. Only ids are submitted; the
  cart also carries display fields because the seat groups show staged picks for every seat while
  candidates are fetched only for the armed one. An intern staged on one seat is excluded from the
  rail for the request's other seats, the same as genuinely put-forward interns.
- **Client-side impact previews must stay worded identically to the server's refusals.**
  `helpers/staffingRequests.js` derives the edit counts and the placed-intern message
  (`getEditImpact` / `describePlacedRefusal`) and the close-out count (`getLeftoverSuggestions`), so a
  pre-flight dialog and the 400 behind it can never disagree. Presentation predicates live here too;
  safe because presentation never authorizes — the rules module's `assert*` functions stay the only
  authority.
- **The admin page reuses the leadership `symphony-*` components** inside its own
  `data-surface="symphony"` div, since those styles are scoped to that attribute and the page lives in
  the sidebar shell, not `SymphonyLayout`.

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
  `interviews[].feedback`, `result.note`, and evaluation `notes`. See `.claude/docs/security.md`.
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
