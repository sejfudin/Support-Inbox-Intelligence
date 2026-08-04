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
- Admins **bypass** membership checks by design (`resolveWorkspaceId` in controllers reads
  `req.query.workspaceId` / `req.body.workspaceId` for admins, otherwise `req.user.workspaceId`).
  When adding admin paths, preserve this pattern; don't let non-admins pass a `workspaceId` override.
- Pattern to copy (see `server/controllers/*` `assertStatusInWorkspace`): fetch the resource,
  404 if absent, then compare `resource.workspace.toString()` to the resolved workspace id and
  reject on mismatch.

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

## Intern access

`server/helpers/internAccess.js` gates which interns a mentor/leadership user may view or edit
(primary/secondary mentor relationships). Reuse it — don't reimplement mentor-intern checks inline.

Recommendations are admin-only, full stop: routes guard writes (POST/PATCH/DELETE) with
`requireRole(ADMIN)`, and the service's `assertReadAccess` / `assertRecommendationWriteAccess`
reject any non-admin (`leadership` is the one exception, with read-only access). Mentors have
no read or write access, on the per-intern tab or the standalone `/recommendations` page. Delete
performs the same write check before removing the record and its history.

**Mentor role is narrower than `canWriteMentorData` alone suggests.** That helper (`admin`, or
`mentor` assigned to the intern) still gates *some* mentor-writable intern data — mentor notes
(`mentorCommentService.js`) and the `expectedEndDate` field in `updateInternProgramme`
(`internService.js`) — but several call sites now layer a stricter, explicit
`user.role !== ROLES.ADMIN` check on top of it instead of trusting `canWriteMentorData`'s mentor
branch:
- **Evaluations** (`evaluationService.js`) — read and write, admin-only (plus `leadership` read).
- **Readiness** (`readinessFlagService.js`) — read and write, admin-only (plus `leadership` read).
- **Internal CV link** (`internService.js` `updateInternalCvLink`) — write is admin-only; read is
  unaffected (`formatProfile`'s `canSeeInternalCv` still allows the assigned mentor to view it).
- **Lifecycle status** (`internService.js` `updateInternProgramme`, the `payload.status` branch)
  — admin-only, even for the assigned mentor. `expectedEndDate` in the same endpoint is not
  restricted this way and still follows plain `canWriteMentorData`.
- **Attendance roster** — admin-only, and enforced at the service layer, not just in the UI:
  `GET /api/attendance` / `GET /api/attendance/:internProfileId` are `requireRole(ADMIN)`. See the
  Attendance paragraph below for the full surface.

When adding a new mentor-facing write path, don't assume `canWriteMentorData` returning `true`
for a mentor means the UI should expose it — check the carve-out list above first.

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
roster `GET /api/attendance` and the per-intern `GET /api/attendance/:internProfileId` (calendar
modal) are **admin-only** (`requireRole(ADMIN)`) — mentors have no attendance surface. Not
workspace-scoped (intern domain). The check-in time-window is enforced server-side
(`server/helpers/attendanceTime.js`, `Europe/Sarajevo`) — never trust the client clock.

Daily standup insights. `GET /api/dailies/admin/overview` and `GET /api/dailies/admin/entry` are
`requireRole(ADMIN)`-guarded, cross-workspace reads (the workspace is passed explicitly via
`?workspace=`, same admin-bypass `assertWorkspaceAccess` grants elsewhere in this file) — no
mentor or intern surface, unlike the other `/api/dailies` routes which reuse `resolveWorkspaceId`'s
ambient admin override. Read-only; derives everything live from existing `Daily` documents.

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
