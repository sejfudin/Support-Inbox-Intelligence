# Security & Authorization

This file is deliberately its own doc. Cross-tenant data leaks and missing role guards are the
highest-risk defects in this codebase. Read it before touching tickets, comments, statuses,
categories, workspaces, rooms, or intern data.

## Golden rule: everything is workspace-scoped

Every ticket / comment / status / category / room operation must be constrained to the caller's
workspace. Never query or mutate a resource by id alone — always also assert it belongs to the
caller's workspace.

- `server/helpers/workspaceAuthz.js`:
  - `canAccessAnyWorkspace(role)` — `admin` and `mentor` may reach any workspace.
  - `isActiveWorkspaceMember(workspace, userId)` — membership check.
  - `hasWorkspaceAccess({ role, workspace, userId })` — the combined gate. Use this.
  - `resolveActiveWorkspaceId({ user, override })` — resolves the **ambient** workspace a
    request acts on. Use this instead of reading `req.user.workspaceId` directly.
- **`User.workspaceId` is a pointer, not proof of membership.** It records the workspace the
  user last switched to and can outlive the membership that made it valid: `switchWorkspace`
  sets it for admins without creating a member entry, a role downgrade (admin/mentor → intern)
  removes the `canAccessAnyWorkspace` bypass while leaving the pointer, and a membership can be
  flipped to `invited`/`disabled` without touching it. Any endpoint that scopes by the pointer
  alone leaks that workspace's data to a non-member — this is what
  `resolveActiveWorkspaceId` exists to prevent. It returns `null` when the pointer no longer
  holds; callers must treat `null` as "no workspace" (empty result / 400), **never** as
  "unscoped" — a query with an undefined workspace filter matches every workspace.
  `server/seeder/cleanupStaleWorkspacePointers.js` clears already-stale pointers in the data.
- `GET /api/auth/me` reports the **verified** workspace in `workspaceId` (resolved through
  `resolveActiveWorkspaceId`), not the raw pointer, so the frontend's `WorkspaceGuard` and
  sidebar gating match what the API will actually serve. Don't seed the `['auth','me']` query
  cache from any other payload — those carry the raw pointer.
- Admins **bypass** membership checks by design (`resolveActiveWorkspaceId` accepts an
  `override` — `req.query.workspaceId` / `req.body.workspaceId` — for admins only; mentors keep
  their ambient pointer but get no override). When adding admin paths, preserve this pattern;
  don't let non-admins pass a `workspaceId` override.
- Pattern to copy (see `server/controllers/*` `assertStatusInWorkspace`): fetch the resource,
  404 if absent, then compare `resource.workspace.toString()` to the resolved workspace id and
  reject on mismatch.
- **A resource's foreign keys are part of its scope.** Scoping the ticket itself isn't enough if a
  field on it can point at another workspace's row — the populated response hands that row's
  contents back. Every workspace-scoped reference a caller can set must be validated against the
  ticket's own workspace: `resolveStatusForWorkspace` (status),
  `ensureAssignableUsersBelongToWorkspace` (assignees), `ensureCategoryBelongsToWorkspace`
  (category) in `ticketService.js`, on both create and update. Add the equivalent check when you
  add a new reference field.

## Socket rooms follow the same rule as HTTP

The pointer rule above binds `server/socket/` too — a websocket is a read surface, so a room a
caller shouldn't reach is the same leak as a route they shouldn't call.

- `canUserJoinWorkspaceRoom` / `canUserJoinTicketRoom` (`socket/socketServer.js`) gate `join_workspace`
  and `join_ticket`: `canAccessAnyWorkspace(user.role)` bypasses for admins and mentors (matching
  their HTTP reach), everyone else must be an active member of the workspace — for a ticket room,
  of `ticket.workspace`. **Do not add a `user.workspaceId` fast path in front of the membership
  query**; that pointer survives a lapsed membership or a role downgrade, and it would hand an
  ex-member a live feed of ticket subjects and descriptions they now get a 404 for over HTTP.
  `authenticateSocket` deliberately does **not** select `workspaceId` onto `socket.data.authUser`,
  so the pointer isn't there to reach for.
- Auto-join on connect (`getUserWorkspaceRoomNames`) resolves rooms from `Workspace.members`
  (active, non-archived) — membership only, never the pointer.
- `getWorkspaceAudienceUserIds` (`socket/events.js`) builds the per-user notification audience from
  platform admins (every workspace, by design) plus the workspace's `owner` and **active** members.
  Mentors are reached only when they are actually members — unlike HTTP, a mentor does not get
  pushed events for every workspace.

## Workspace lifecycle roles

- **Create** (`POST /api/workspaces`): platform `admin` or `mentor`. The creator becomes the
  workspace owner and an active workspace-`admin` member, and their active workspace switches
  to the new one.
- **Delete** (`DELETE /api/workspaces/:id`): platform `admin` (any workspace), or `mentor` who
  owns / is workspace-admin of that workspace — enforced by `requireRole(ADMIN, MENTOR)` +
  `requireWorkspaceManager` chained. Other workspace-admin members (e.g. interns) cannot delete.
- **List all** (`GET /api/workspaces/all`): platform `admin` only. Mentors have no global
  workspace surface — they only see workspaces they belong to.

## Reference data is an intentional exception to the golden rule

`Position`, `Technology`, and `Project` (`server/routes/projects.js`) are **firm-global**, not
workspace-scoped — the intern/recommendation domain has no `workspace` field anywhere. Don't add
`requireWorkspaceManager`/workspace guards to these routes; that would be wrong, not extra-safe.
`Project` writes (`POST`/`PATCH /api/projects`) are `requireRole(ROLES.ADMIN)` only — mentors can
read/select a project (needed for the recommendation form) but cannot create or edit one. The
locked "Unspecified" sentinel project (`isSystem: true`) additionally rejects edits at the service
layer regardless of role.

`POST /api/projects/:id/request-interns` is the one exception to "leadership is read-only" stated
throughout this file — gated `requireRole(ROLES.LEADERSHIP)` (not admin, deliberately: this is
leadership's own action, not something an admin would call). It cannot create/edit/delete a
`Project` or anything else — `projectService.requestInternsForProject` only reads the project (to
404 on a missing/system one) and fans out a notification to every active admin
(`internNotificationService.notifyInternRequestFromLeadership`). No new persisted write surface —
if this route is ever extended to actually create a tracked record, treat that as a new resource
needing its own authz review, not an extension of this narrow notify-only action.

`GET /api/projects/:id` has no role gate beyond `protect`, same as the existing `GET /api/projects`
list. `GET /api/projects/overview` and `GET /api/projects/:id/overview` (the leadership Projects
page) are gated in the service layer, not route middleware — `assertLeadershipReadAccess` in
`projectService.js` 403s anyone who isn't `admin` or `leadership`, mirroring `READ_ROLES` /
`assertReadAccess` in `recommendationService.js`. Mentors and interns have no access to either.

## Intern access

`server/helpers/internAccess.js` gates which interns a mentor/leadership user may view or edit
(primary/secondary mentor relationships). Reuse it — don't reimplement mentor-intern checks inline.

**Interns may read their own recommendations, evaluations and readiness — and nothing else of any
of them.** Three narrow self-only reads back the intern dashboard's "My Selection Process" / "My
evaluations" cards and the "My Progress" page:
`recommendationService.listOwnRecommendations(user)`,
`evaluationService.listOwnEvaluations(user)` and
`readinessFlagService.listMyReadinessFlags(user)`. All are separate functions from the admin list
paths (which still 403 an intern outright), the first two re-check `role === INTERN` at the service
layer, and all three resolve the `InternProfile` **from the authenticated user** — there is no id
parameter to tamper with. They are reachable only through `GET /api/dashboard/me`,
`GET /api/dashboard/me/progress` and `GET /api/interns/me/readiness`, none of which take any query
parameters at all.

`listOwnRecommendations` returns **every** recommendation belonging to the caller, not just the
newest — the card switches between them and the progress page lists them all. That widens the
payload but not its scope: the records are still only ever the caller's own, and each is the same
redacted shape described below.

Their return shapes are **redacted, by picking fields rather than deleting them**, so a field added
to either model later is absent by default instead of leaking. Withheld from the intern:
`recommendationNote` (the admin's internal pitch), `interviews[].feedback` (the interviewer's
write-up, which has its own `concerns` field), and `result.note` (the reasoning behind a placement
decision). Shown: stage, stage dates, project, position, scheduled interviews, the placement
outcome and start date, and evaluation scores/periods/author/notes. **If you add a field to either
formatter, check first whether it is written *about* the intern rather than *to* them.**

**Evaluation `notes` used to be withheld and now are not** (`formatOwnEvaluation`). The reasoning:
the notes are the mentor's written feedback *to* the intern that goes with the four scores, and a
score with no explanation is not something anyone can act on — unlike the three recommendation
fields above, which are written *about* the intern to support a placement decision. `MentorComment`
stays internal **by default**: its `visibleTo` recipient list is a staff-only sharing mechanism
(admin/mentor/leadership), and a note is invisible to the intern it's about unless its author
explicitly set the separate `visibleToIntern` flag *at write time* (`mentorCommentService.js`
`createComment`) — the exact "author-side visibility choice, not a read-side change" this
paragraph used to say didn't exist. `listComments` reflects that split: a staff caller still gets
the `visibleTo`/authorship view via `canReadComment`, completely unaware of `visibleToIntern` —
**except an admin, who bypasses `visibleTo`/authorship entirely and reads every note on the
intern regardless of who wrote it or who they shared it with.** That bypass is required, not just
generous: the UI labels an empty `visibleTo` "Admins only" (`audienceOf` in
`InternCommentsPanel.jsx`), which is a promise that admins are the *floor* of every note's
audience — without the bypass, a mentor's note with nobody added to `visibleTo` was readable by no
admin at all, silently the opposite of what the label said. `MENTOR` and `LEADERSHIP` viewers get
no such bypass; they still need to be the author or named in `visibleTo`. An `INTERN` caller gets a
different, narrower query still — only their own profile's comments where
`visibleToIntern: true` — and never sees `visibleTo`, `visibleToIntern`, or `internProfile` in the
response (`formatCommentForIntern` strips them). Keeping `visibleToIntern` a distinct field rather
than allowing the intern's own id inside `visibleTo` matters: it means the staff-sharing list and
its future bulk operations can never accidentally expose a note to its subject. Every note written
before this field existed defaults to `false`, so nothing already on file became intern-visible
retroactively.

**The mentor-note audience picker (`InternCommentsPanel.jsx`) must never offer a whole-role
shortcut.** Every `visibleTo` recipient is picked by name, one at a time — no "all mentors", "all
admins", or "all leadership" button, because that would let one click hand a note to an entire
role. The only bulk action is narrowing to "Admins only" (clearing the list). If you're re-adding
convenience to this picker, a role-scoped multi-select is the one shape it must not take.

**Readiness is now readable by the intern for themselves, and only by that path.**
`listReadinessFlags` (the `:userId` route) stays admin-only, `upsertReadinessFlag` stays
admin-only, and `listMyReadinessFlags` resolves the profile from `req.user` with no id parameter.
The progress payload joins those flags to the intern's *declared* technologies and position in
`helpers/readinessSummary.js`, so a position flag left over from a previous role reads "Not
assessed" rather than carrying a stale level onto the new one.

Recommendations are otherwise admin-only: routes guard writes (POST/PATCH/DELETE) with
`requireRole(ADMIN)`, and the service's `assertReadAccess` / `assertRecommendationWriteAccess`
reject any non-admin (`leadership` is the one exception, with read-only access). Mentors have
no read or write access, on the per-intern tab or the standalone `/recommendations` page. Delete
performs the same write check before removing the record and its history.

Read that as **only admins write recommendations _directly_**. There is one indirect path: closing a
staffing request resolves every candidate still in selection for it, and cancelling is
leadership-only, so a leadership user can cause that write — see "Staffing requests" below and
`docs/adr/0004`. It goes through `recommendationService.closeOutRecommendationsForDemandEnd`, never
through the recommendations routes, which stay `requireRole(ADMIN)`.

**Mentor role is narrower than `canWriteMentorData` alone suggests.** That helper (`admin`, or
`mentor` assigned to the intern) still gates *some* mentor-writable intern data — mentor notes
(`mentorCommentService.js`) and the `expectedEndDate` field in `updateInternProgramme`
(`internService.js`) — but several call sites now layer a stricter, explicit
`user.role !== ROLES.ADMIN` check on top of it instead of trusting `canWriteMentorData`'s mentor
branch:
- **Evaluations** (`evaluationService.js`) — `listEvaluations` / `createEvaluation` are admin-only
  (plus `leadership` read). The intern's own redacted read is a separate function — see above.
- **Readiness** (`readinessFlagService.js`) — the `:userId` read and the write are admin-only (plus
  `leadership` read); `listMyReadinessFlags` is the intern's own self-scoped read — see above.
- **Internal CV link** (`internService.js` `updateInternalCvLink`) — write is admin-only; read is
  unaffected (`formatProfile`'s `canSeeInternalCv` still allows the assigned mentor to view it).
- **Lifecycle status** (`internService.js` `updateInternProgramme`, the `payload.status` branch)
  — admin-only, even for the assigned mentor. `expectedEndDate` in the same endpoint is not
  restricted this way and still follows plain `canWriteMentorData`.
- **CV summary** (`internCvSummaryService.js`) — the read
  (`GET /interns/:userId/cv-summary`) is `canReadMentorAssessment`: admin, leadership, or the
  assigned mentor. Generating (`POST`) additionally requires `canWriteMentorData`, so leadership
  reads a cached summary but never spends the model call. Neither verb is available to the intern
  for their own profile — `assertInternAccess`'s default `canViewInternProfile` would admit them,
  which is why both paths re-check with a narrower predicate.
- **Attendance roster** — admin-only, and enforced at the service layer, not just in the UI:
  `GET /api/attendance` is `requireRole(ADMIN)`. The per-intern
  `GET /api/attendance/:internProfileId` also admits `MENTOR`, but scopes them to their own
  interns in the service. See the Attendance paragraph below for the full surface.

When adding a new mentor-facing write path, don't assume `canWriteMentorData` returning `true`
for a mentor means the UI should expose it — check the carve-out list above first.

**Intern notifications must not leak admin/mentor-private fields.**
`internNotificationService.js` (see `.claude/docs/architecture.md` § Notifications) generates
AI-flavored text as a side effect of admin/mentor/leadership writes to intern data — every prompt
input and deterministic fallback must stay within what the *recipient* is already allowed to see.
Never pass `Recommendation.recommendationNote`, `interviews[].feedback`, or `result.note` (all
three withheld from the intern in `formatOwnRecommendation`), or `Evaluation.notes` (withheld in
`formatOwnEvaluation`) into anything that could reach the intern. `internService.js
#updateInternalCvLink` gets **no notification at all**, to anyone — `internalCvUrl` is modeled as
never visible to the intern (`formatProfile`'s `canSeeInternalCv` excludes `INTERN`), and it has no
other audience either. `mentorCommentService.js#createComment` has **two independent notification
axes now**, matching the two `MentorComment` audience fields: each `visibleTo` recipient
(already-authorized admin/mentor/leadership) gets `notifyMentorNoteMention` — never the note's
content, since that isn't needed to justify "delivery" and keeps the AI prompt input minimal — and,
separately, if the author set `visibleToIntern`, the intern gets `notifyInternMentorNoteShared`.
That second one is *not* a leak: it only fires for the one note the intern is now explicitly
allowed to read in full (`listComments`' intern branch), so the notification revealing "a note was
shared with you" tells them nothing they can't already open. An ordinary staff-only note
(`visibleToIntern: false`, the default) still notifies zero interns — that asymmetry is unchanged
and remains the point of this paragraph. If you add a new admin/mentor/leadership write to intern
data, check this list before wiring a notification for it, and be explicit about which recipient
axis (intern vs. staff) it belongs to.

Specializations. `/api/specializations` (list/candidates/assign/reassign/change-mentor/clear, all
`requireRole(ADMIN)` at the route) plus `specializationService#assertSpecializationAccess` at the
service layer — mentors have no read or write surface, even for their own assigned interns. Not
workspace-scoped (intern domain, same exception as Recommendations/Project above). The intern's own
`PATCH /api/interns/me/position` now additionally rejects the write with 403
(`canInternEditDeclaredPosition`) once `specializationAssignedAt` is set — the secondary-position
endpoint is unaffected (stays intern-writable). Reassign/change-mentor/clear additionally 400 via
`loadSpecializedProfile` if the target intern has no specialization to manage — there's no way to
reach these mutations for an unspecialized intern even with a crafted request.

Attendance. `/api/attendance/me` (GET/POST/DELETE) is `requireRole(INTERN)` and always resolves the
caller's **own** `InternProfile` — an intern can only ever read or write their own attendance. The
roster `GET /api/attendance` is **admin-only** (`requireRole(ADMIN)`). The per-intern
`GET /api/attendance/:internProfileId` (calendar modal, and the Attendance tab on the intern
profile) is `requireRole(ADMIN, MENTOR)` — the role guard alone is not enough here, so
`getInternAttendance` re-checks in the service: a non-admin must be `isAssignedMentor` for that
profile or the read 403s. One mentor cannot read another mentor's intern. Not
workspace-scoped (intern domain). The check-in time-window is enforced server-side
(`server/helpers/attendanceTime.js`, `Europe/Sarajevo`) — never trust the client clock.

Daily standup insights. `GET /api/dailies/admin/overview` and `GET /api/dailies/admin/entry` are
`requireRole(ADMIN)`-guarded, cross-workspace reads (the workspace is passed explicitly via
`?workspace=`, same admin-bypass `assertWorkspaceAccess` grants elsewhere in this file) — no
mentor or intern surface, unlike the other `/api/dailies` routes which reuse `resolveWorkspaceId`'s
ambient admin override. Read-only; derives everything live from existing `Daily` documents. Both go
through `assertAdminWorkspaceTarget`, which validates the id and **confirms the workspace exists**
before querying — `assertWorkspaceAccess` returns early for admins without touching the DB, so
leaning on it alone would turn a malformed id into a 500 and an unknown or archived one into a
fully-rendered all-zeros coverage grid that reads as "nobody reported". The ambient `/api/dailies`
routes 400 when `resolveActiveWorkspaceId` resolves to `null`, in `controllers/dailies.js` — never
pass `null` on to the service, an unscoped workspace filter matches every workspace.

Intern dashboard. `GET /api/dashboard/me` is `requireRole(INTERN)`, read-only, and takes **no
parameters** — the subject is always `req.user`. That is deliberate and load-bearing: the payload
includes the caller's own (redacted) recommendations and evaluations, so the absence of any
workspace or intern override is what keeps it self-scoped. Do not add one, and do not open the
route to another role — the admin board is the cross-workspace surface. The workspace half of the
payload (workload, tickets, standup) resolves through `resolveActiveWorkspaceId`, never the raw
`user.workspaceId` pointer, so an intern whose membership lapsed reads as "between workspaces"
(programme cards only) instead of keeping the workspace they left; it then verifies that workspace
still exists, so an archived one 404s instead of returning empty blocks that read as "no work".

`GET /api/dashboard/me/progress` follows the identical rule and is the **widest self-read on the
platform** — `requireRole(INTERN)`, read-only, no parameters, subject always `req.user`. It carries
the caller's evaluations *including the mentor's written notes*, their readiness levels, and every
recommendation they have been part of, so the absence of any intern override is the entire
authorization story. Do not add one, and do not open the route to another role: the admin surfaces
for the same data (`/api/interns/:userId/evaluations`, `/:userId/readiness`, `/api/recommendations`)
already exist and are where cross-intern reads belong. Unlike `GET /api/dashboard/me` it touches no
workspace at all — every section is programme data — so there is no `resolveActiveWorkspaceId` in
it and nothing for a stale pointer to leak.

`POST /api/dashboard/me/standup-summary` follows the same rule — `requireRole(INTERN)`, no
parameters, and it locates the entry by matching `entry.member` against `req.user`, so an intern
can only ever summarise a note they wrote themselves. It resolves its workspace through
`resolveActiveWorkspaceId` too, and 400s on `null`: this path **writes** (`daily.save()`) and
spends a Groq call, so a stale pointer must not reach either. It also re-checks the length threshold
server-side: the client only asks when it believes a note is long, but letting the client decide
would mean a frontend change could quietly start spending AI calls on two-line notes.

Admin dashboard. `GET /api/admin/dashboard?workspaceId=` is `requireRole(ADMIN)`, read-only, and
takes its workspace **explicitly from the query string** — the same admin-bypass pattern as the
standup-insights routes above, and the reason it must not be loosened to another role: any caller
who reaches it reads an arbitrary workspace's roster and workload, **plus platform-wide placement
and specialization records that are not workspace-scoped at all** (see below). Admin-only is
load-bearing here.

Three things to preserve when touching `adminDashboardService.js`:
- **`loadPlacements()` and `loadSpecializations()` are deliberately unscoped** — the first reads
  every `placed` `Recommendation` on the platform, the second every `InternProfile` carrying a
  `specializationAssignedAt`, because placement and specialization are programme milestones on the
  intern's profile rather than workspace events. These are the only two places on the payload that
  ignore `workspaceId`, and it is only acceptable because the route is admin-only. If this endpoint
  is ever opened to mentors or leadership, both halves of the placements / specialization card must
  be re-scoped first — otherwise it becomes a cross-tenant read.
- **It verifies the workspace exists itself** (404 on unknown/archived, 400 on a malformed id).
  `assertWorkspaceAccess` returns early for admins *without touching the DB*, so leaning on it
  alone would turn a bogus or archived workspace id into a convincing all-zeros payload rather
  than an error.
- **Intern scoping goes through `Workspace.members`** via `helpers/workspaceInterns.js`, never
  `User.workspaceId`. `InternProfile` has no `workspace` field, and `User.workspaceId` is only the
  member's currently *active* workspace — scoping on it silently omits interns who belong to this
  workspace but are switched into another one.

## Staffing requests — first leadership write path

This section is the authority on who may do what to a staffing request. How the feature works —
model, rules module, put-forward flow, close-out cascade — is `.claude/docs/staffing-requests.md`.

`/api/staffing-requests` (`server/routes/staffingRequests.js`,
`server/services/staffingRequestService.js`) is the **first route on the platform that admits
`ROLES.LEADERSHIP` for a write** — no other feature's middleware default covers this, so every
route guards explicitly rather than inheriting one. Not workspace-scoped (intern/project domain,
same exception as `Project`/`Recommendation` above).

- **Read** (`GET /`, `GET /:id`): `requireRole(ADMIN, LEADERSHIP)` at the route, plus
  `assertReadAccess` at the service layer. Every request, regardless of author — leadership can
  cover for a colleague.
- **Create** (`POST /`): `requireRole(LEADERSHIP)` only — an admin cannot file one. Recorded demand
  must trace back to an outside ask that came through leadership.
- **Update** (`PATCH /:id`): route-gated to `LEADERSHIP` (everyone else, admins included, 403s
  before the resource even loads), then narrowed in `assertWriteAccess` to **the request's own
  author** — a leadership user who didn't file it gets the same 403 a mentor would, one level
  later. The ask belongs to whoever made it: an admin answers a request rather than restating it,
  and since ticket 10 an edit writes other people's recommendations, so the narrowest set of
  editors is the right default.
  Edit legality is enforced by one call into `helpers/staffingRequestRules.js`
  (`planStaffingRequestEdit`), never re-implemented in the service: a closed request rejects every
  edit, count floor of 1, duplicate position rejected, and — the only refusal about other people's
  records — **a requested position with a `placed` intern cannot be ended**, as a 400 naming them.
  A position with candidates merely *in selection* may be changed or removed; doing so runs ticket
  09's close-out cascade, so `PATCH /:id` is the second path on which a leadership author causes
  writes to recommendations, under the same mandatory `notPlacedReason` (ticket 10). Note there is
  **no project lock**: putting interns forward does not freeze the project reference, the author or
  an admin may repoint it (which repoints every tagged recommendation), and the
  `assertProjectEditable` helper that once said otherwise is gone (see `docs/adr/0006`). Setting the
  *first* project is still admin-only resolution — `planStaffingRequestEdit` refuses it.
- **Close** (`POST /:id/close`): route-gated to `ADMIN`/`LEADERSHIP`, then split **per reason** in
  `assertCanClose`. Deliberately **not** behind `assertWriteAccess`: cancelling belongs to any
  leadership user, not only the author, so the service asserts the read tier and lets the rules
  helper decide. **There is no reopen route** — `closed` is terminal (`docs/adr/0005`).
- **The close reason carries its own authorization**, and it lives in `assertCanClose`, not the
  router. One sentence: **leadership withdraws, admin answers**. `cancelled` is **leadership-only**
  (any leadership user; an admin gets a 403 — only leadership speaks to the outside party, so only
  they can state the demand is gone); `fulfilled`/`declined` are **admin-only**. `cancelled` and
  `declined` both additionally require a non-empty note — they are the two closes that leave the ask
  unmet, and nothing on a closed request can be revised afterwards, so a blank reason would be
  permanent. `fulfilled` does not: the placements are the explanation. This is why closing is one route taking `reason` in the
  body rather than three routes — a `requireRole(ADMIN)` on a fulfil-only route would put half the
  rule in the router and leave the two copies free to drift. A leadership user asking to close a
  request as `fulfilled` gets a **403**, not a 400: the rules helper tags authorization refusals with
  a `StaffingRequestForbiddenError`, which carries `statusCode: 403` the way `StatusValidationError`
  does; an illegal *move* is a plain `Error`, which has no status and falls to 400. The service maps
  by reading `statusCode`, never by matching message text.
- **Closing writes other people's recommendations, and that is the one place a non-admin does.**
  Every close resolves each candidate still in selection as `not_placed` with `result.demandEnded`
  and one shared, mandatory `notPlacedReason`
  (`recommendationService.closeOutRecommendationsForDemandEnd`). Since cancelling is leadership-only,
  a leadership user can cause that write and `result.decidedBy` records them — correct, not a bug,
  they did decide it (`docs/adr/0004`). So the rule stated further up this file reads precisely: only
  admins write recommendations **directly**; the staffing-request cascade writes them on behalf of
  whoever legitimately closed the request. There is no batch close-out anywhere outside the
  staffing-request flows, and no unattended trigger — nothing auto-closes, because the cascade needs
  a reason nothing unattended can author.
- **`result.demandEnded` cannot be set through the recommendations API.**
  `applyResultPayload` ignores the field on `PATCH /recommendations/:id` whatever the payload says.
  An admin who could set it by hand could label a genuine rejection as the demand ending, and the
  intern would be told the opportunity was withdrawn when they were actually turned down. It is also
  the one part of `result` besides the outcome and dates that reaches the intern —
  `formatOwnRecommendation` still withholds `result.note`, so the reason typed at close time is read
  only by admins, leadership and mentors.
- **`PATCH /:id` cannot close anything.** `updateStaffingRequest` writes only
  `requestedPositions`, `neededBy`, `project` and `draftProject` — `status`, `reason` and `note` are
  not accepted, so neither a close nor an admin's remark can ride in on a generic edit and bypass
  `assertCanClose` — which is now the only writer of either. Keep it that way. It *can* resolve candidates, but
  only through the same cascade a close uses, and only for a position the request stopped asking
  for.
- **Where a close note lands depends on the reason**, and the two fields are not interchangeable:
  `cancelled` → `closeNote`, mandatory (withdrawing an ask must never overwrite an admin's remark, so
  it gets its own field); `declined` → `note` + `noteBy` + `noteAt`, mandatory; `fulfilled` → `note`
  if one was supplied.
  The separate `notPlacedReason` never lands on the request at all — it goes to each closed-out
  recommendation's `result.note`.
- **A closed request is frozen.** No route writes to one — there is no note endpoint, no reopen, and
  no delete. The reason given at close time is the record, which is why `cancelled` and `declined`
  demand one (`docs/adr/0005`). A mis-close is corrected by filing the ask again, not by editing the
  dead request.
- **Putting interns forward** (`GET /:id/positions/:positionId/candidates`,
  `POST /:id/put-forward`) is **admin-only** at the route and re-asserted in
  `assertCanPutForward` — leadership files demand, admins answer it, and there is no author
  carve-out. Both routes also refuse a closed request and one that still needs its project; that
  second refusal is structural, not cosmetic (`Recommendation.project` is required). The read is
  scoped to one requested position by **path segment**; the write is request-level and takes
  `{ groups: [{ positionId, internProfileIds }] }`, but the position is still never free — every
  group's `positionId` must be one the request actually asked for (`findRequestedPosition`, which
  throws otherwise). That is what "the position is forced" means server-side, and it is why no
  payload can steer a recommendation onto a discipline nobody asked for. A group naming a position
  twice is refused outright.
- **The picker's eligibility rules are enforced on the write, not only on the read.** The write path
  re-runs `partitionPickerCandidates` per group over the picked profiles, so a stale or bypassed
  client cannot offer an intern who has left the programme, or double-offer one already in selection
  for that same requested position. Interns already placed, or in selection *elsewhere*, are
  deliberately allowed through — the rules warn there, they do not block. One further rule belongs
  to the body rather than the picker and is checked beside it: the same intern may not appear under
  two seats of one request.
- **A submit is all-or-nothing, and its refusals are per row.** Any rejected pick aborts the whole
  submit before a single recommendation is inserted, and comes back as `409` with
  `data: { rejections: [{ positionId, internProfileId, reason }] }`. The reasons are written words,
  never the rules helper's own flag tokens. Nothing about this is advisory to the client: the cart
  the admin stages is client-side only, so the submit is the first and only point the server has
  ever seen these picks.
- **The candidates route leaves the request's own data.** It reads every in-programme
  `InternProfile` and their recommendations across all projects, which is what the "in selection on
  Borealis" flag needs. That is admin-only and admins already read every intern, so it widens
  nobody's access — but keep the route admin-only for exactly this reason.
- **Mentors and interns get 403 from every route**, including list/read — there is no aggregate-only
  view for them. A mentor therefore cannot answer a request either; no mentor is attached to a
  request at all today.
- **No delete route, ever.** Cancelling (`status: closed`, `reason: cancelled`) is the only way a
  request goes away; deleting would orphan `Recommendation.staffingRequest` references and the
  demand history that justifies the feature.
- Filing against a project that already has an open request is **allowed, and not even checked on
  create** — a second wave of demand months later is legitimately its own request. The filing screen
  warns beforehand off `GET /api/staffing-requests?projectId=&status=open` (the `projectId` filter
  exists for exactly this), so the author still has the choice; the server never blocks it.
- **A request may be filed with `draftProject` instead of `projectId`** — leadership describes a
  project that doesn't exist yet. It reads **Needs project**
  (`helpers/staffingRequestRules.js#needsProject`) and can never close as `fulfilled`
  (`assertCanClose` rejects that reason whenever `needsProject` is true — enforced server-side, not
  only hidden in the UI); `cancelled`/`declined` are unaffected.
- **Resolving a draft project** (`POST /:id/resolve-project`, `POST /:id/resolve-project/create`) is
  **admin-only**, checked directly in the service (`resolveStaffingRequestProject*`) rather than
  through `assertWriteAccess` — unlike every other write on this model there is no author-or-admin
  carve-out; leadership can never create or link a project through this flow, only describe one.
  `assertCanResolveProject` refuses a request that already has a project or is closed.
  `draftProject` is never overwritten by resolution — it stays on the document alongside the newly
  set `project` reference, as the record of what was actually asked for.
- **Creating a project from a draft** (`…/resolve-project/create`) proactively checks for a slug
  collision before inserting and returns it as a 409 with
  `{ data: { existingProject } }` — never a raw Mongo `E11000`. The unique index on `Project.slug`
  is still the last-resort catch for the race between that check and the insert, mapped to the same
  friendly shape. The admin chooses `type`, `status` and `technologies` fresh; none are seeded from
  the request even though `name`/`client`/`description` are prefilled from the draft on the client.

## Middleware guards (`server/middleware/`)

- `auth.js` `protect` — required on every authenticated route. Verifies JWT + `tokenVersion`.
- `requireWorkspaceManager.js` — gate for per-workspace management actions (workspace `admin`
  role / owner). Exports:
  - `requireWorkspaceManager` — default guard. Resolves the workspace from
    `params.workspaceId` / `params.id` / body / query / the caller's active workspace.
    **Only use it when `:id` in the route IS a workspace id.**
  - `workspaceManagerGuard(resolveWorkspaceId)` — factory for routes whose `:id` is a
    resource id (categories, ticket statuses): pass an async resolver that loads the resource
    and returns its `workspace`; throw an error with `statusCode: 404` if the resource is gone.
  - On success the guard stashes the authorized id on `req.managedWorkspaceId` (non-admins
    only). **Controllers on guarded routes must write to `req.managedWorkspaceId`** — never
    re-resolve from body/user — so the write target can't drift from what was authorized.
    A non-admin may pass `workspaceId` in body/query only because the guard verifies they
    manage that exact workspace first.
- `GET /api/workspaces/:id` is scoped in `workspaceService.getWorkspaceById(id, caller)`:
  active members only; **only platform admins bypass** (not mentors — `hasWorkspaceAccess`'s
  mentor bypass is deliberately not used here). The payload includes member emails and pending
  invitations, so it must not be readable cross-tenant.
- `role` (file, exports `requireRole(...allowedRoles)`) — platform-role guard; 403s if
  `req.user.role` is not in the allowed list. Import `ROLES` and pass them:
  ```js
  router.post('/', protect, requireRole(ROLES.ADMIN), createHub);
  ```
- Apply guards in the route file, in order: `protect` first, then role/workspace guards, then
  upload middleware, then the controller.

## Credentials

- **Changing your own password requires the current one.** `PATCH /api/auth/me/password` →
  `authService.changeOwnPassword`, which `bcrypt.compare`s the supplied current password against
  the stored hash before writing anything. Applies to every role; the account comes from the
  token, never from the URL, so there is no self-service path that skips the check.
- `PATCH /api/auth/:id` **refuses `password` when the caller is the target** and points at the
  endpoint above. It still accepts `password` for an admin editing *another* user — that is a
  reset for someone locked out, who by definition cannot supply their old password. Leaving both
  doors open would have made the check optional.
- A successful change bumps `tokenVersion` and deletes every `RefreshToken` for that user, so a
  password change evicts anyone holding a stolen session. The endpoint answers with a fresh token
  pair for the caller, since the bump invalidates their own access token too.
- Wrong password, no password set, and no such user all return the same 401. Do not add a message
  that tells them apart.
- Not covered by any of this: `POST /api/auth/invite/set-password`, which is guarded by the
  single-use invite token instead — there is no old password at that point.

## Test accounts

`User.isTestAccount` marks an internal QA account (created by `server/seeder/seedTestAccounts.js`,
safe to run against production — see `.claude/docs/workflows.md`) that must log in and work
exactly like a real one, but never appear in a listing meant for real users.

- **The exclusion lives at the query, not the role or a read-side filter** — `{ isTestAccount:
  { $ne: true } }` added directly into the filter object, same idiom as `Project.isSystem`
  (`projectService.js`). `adminService.getUsers` is the one choke point almost every
  mentor/leadership-surfacing listing already shares (mentor-assignment picker, specialization
  picker, ticket-assignee/workspace-member picker, the unscoped platform-wide list) — the
  exclusion there covers all of them at once. `server/controllers/interns.js#listCommentViewers`
  (the mentor-notes "Share with" audience picker) now calls `adminService.getUsers` too rather
  than keeping its own copy of the query, so there is nowhere left with a second filter to fall
  out of sync.
- **`includeTestAccounts: true` is the one deliberate bypass**, and it is admin-gated at the
  controller (`server/controllers/admin.js#getUsers`: `isAdmin && includeTestAccounts === 'true'`
  — a non-admin passing the query param is silently ignored, not honored), not just left to the
  frontend to not ask for it. Platform Management's "All Users" screen is the only caller that
  passes it, because an admin still needs to find and manage these two accounts. **Do not add
  this param to any other `useUsers`/`getUsers` call site** — every mentor/leadership picker must
  keep getting the exclusion for free by doing nothing.
- **A test account is otherwise a completely ordinary user** — same role, same `canWriteMentorData`
  /`canViewInternProfile`/etc. checks, same login flow, no additional restriction anywhere. If it
  genuinely does something (writes a mentor note, files a staffing request), that record's
  authorship is real and stays visible on the record itself — the exclusion is about *listings of
  who mentors/leadership are*, not about hiding evidence that the account acted.
- If you add a new listing of mentors or leadership-role users, route it through
  `adminService.getUsers` rather than a fresh `User.find`. If that is genuinely not possible, add
  `isTestAccount: { $ne: true }` to the new query directly — do not add a role-based or
  name-based heuristic instead.

## Self-only endpoints carry no id

- `GET`/`PATCH /api/users/me/preferences` resolves the subject from the token
  (`req.user.id`), never from the URL or the body. There is no id to guard and no
  cross-user read path — do not add one. A future self-only endpoint should follow the
  same shape: `/me`, subject from the token.
- The patch is **key-validated against the enum table**
  (`server/constants/userPreferences.js`), with own-property lookups only. An inherited
  key (`toString`, `constructor`, `__proto__`) resolves to nothing rather than to a
  function on `Object.prototype`, so a junk key is shrugged off instead of throwing a
  500. Keep both properties if you touch the validator.
- Preferences are UI taste, not authorization. Nothing may read them to decide what a
  caller can see or do.

## The preference cache is not a trust boundary

- `localStorage` caches preferences, and **sign-out deliberately keeps the cache** so the
  return is flash-free. On a shared browser the next person therefore sees the previous
  person's cache. `frontend/src/lib/preferenceCacheOwner.js` stamps the owner, and the
  one-time migration adopts a cache **only** when it can prove it is this user's.
  Never adopt or upload an unstamped cache.
- The cache holds no secret — do not put one there. The session tokens stay under their
  own keys, owned by `api/axios.js` and `context/AuthContext.jsx`.
- The access token is read outside the axios interceptor in exactly one place: the
  `keepalive` unload flush in `frontend/src/api/userPreferences.js`, which must outlive
  the document. It builds its header with `authorizationHeader()` from `api/axios.js`, so
  the token is still read in one place. Do not add a second such caller without the same
  hard reason.

## Input handling

- **Sanitize user-supplied rich-text HTML** (TipTap ticket descriptions — anything rendered
  client-side via `dangerouslySetInnerHTML`) with `sanitize-html` before storing, via
  `server/helpers/htmlSanitize.js`. Never trust client HTML at an HTML sink.
- **Plain-text fields (comments) are stored verbatim** — they render through React's text-node
  escaping, never an HTML sink. Do not HTML-sanitize them: `sanitize-html` entity-encodes
  `&`/`<`/`>` into the stored value and corrupts text like "A & B". Escape at the sink, not on input.
- Validate AI-related input via `server/helpers/aiValidationRules.js`.

## Secrets

- All config from `server/.env`. Never commit it. Never log secret values.
- GitHub installation tokens are **encrypted at rest** (`GITHUB_ENCRYPTION_KEY`, `server/helpers/crypto.js`).
- JWT secrets: `JWT_SECRET`, `JWT_REFRESH_SECRET`.

## When reviewing / writing an endpoint, checklist

1. Is `protect` applied?
2. Is the resource scoped to the caller's workspace (not just fetched by id)?
3. Can a non-admin escalate by passing `workspaceId` in query/body? (must not)
4. Is the platform role AND workspace-membership role checked where the action requires it?
5. Is user HTML sanitized?
6. Does the response leak fields the caller shouldn't see (other workspaces, other interns)?
7. If it writes a credential, does it re-prove the caller owns it? (see Credentials)
8. If it is a `/me` endpoint, does the subject come from the token rather than the request?
