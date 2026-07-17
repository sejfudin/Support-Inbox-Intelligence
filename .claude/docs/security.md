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

## Intern access

`server/helpers/internAccess.js` gates which interns a mentor/leadership user may view or edit
(primary/secondary mentor relationships). Reuse it — don't reimplement mentor-intern checks inline.

Recommendations follow this exactly: routes guard writes (POST/PATCH/DELETE) with
`requireRole(ADMIN, MENTOR)`, and the service's `assertRecommendationWriteAccess` →
`canWriteMentorData` further restricts mentors to their assigned interns (admins may write for
any intern). Reads also allow `leadership`; mentors can only read recommendations of interns
they mentor. Delete performs the same write check before removing the record and its history.

## Middleware guards (`server/middleware/`)

- `auth.js` `protect` — required on every authenticated route. Verifies JWT + `tokenVersion`.
- `requireWorkspaceManager.js` — gate for per-workspace management actions (workspace `admin` role).
- `role` (file, exports `requireRole(...allowedRoles)`) — platform-role guard; 403s if
  `req.user.role` is not in the allowed list. Import `ROLES` and pass them:
  ```js
  router.post('/', protect, requireRole(ROLES.ADMIN), createHub);
  ```
- Apply guards in the route file, in order: `protect` first, then role/workspace guards, then
  upload middleware, then the controller.

## Input handling

- **Sanitize all user-supplied HTML** (comments, rich text / TipTap) with `sanitize-html` before
  storing. Never trust client HTML.
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
