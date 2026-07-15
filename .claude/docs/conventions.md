# Conventions

## Exemplars — copy these when adding something new

Follow a working example over an abstract rule. When you add a new piece, mirror the structure of:

- **A backend resource** (route + controller + service + model): follow the `ticket` slice —
  `server/routes/ticket.js`, `server/controllers/tickets.js`, `server/services/ticketService.js`,
  `server/models/Ticket.js`. Thin controller, logic in the service, workspace-scoped throughout.
- **A workspace-scoped / authz'd endpoint**: copy the `resolveWorkspaceId` +
  `assertStatusInWorkspace` pattern in `server/controllers/ticketStatuses.js` — fetch by id,
  404 if missing, reject if `resource.workspace` ≠ caller's workspace. See @security.md.
- **A role-gated endpoint**: mirror `server/routes/hubs.js`
  (`protect, requireRole(ROLES.ADMIN), handler`).
- **A frontend resource** (HTTP + data hooks): mirror `src/api/tickets.js` (axios helper) +
  `src/queries/tickets.js` (React Query hooks). Components consume the hook, never axios.
- **A custom error type**: follow `StatusValidationError` in `server/helpers/statusValidation.js`
  (carries `statusCode`, mapped to an HTTP status in the controller's catch).

## Module systems

- **Backend** (`server/`): CommonJS — `require` / `module.exports`. `type: commonjs`.
- **Frontend** (`frontend/`): ESM — `import` / `export`. `type: module`.

## Backend

- **Layering**: `routes/ → controllers/ → services/ → models/`. Controllers stay thin: parse
  request, call a service, shape the response. Business logic lives in services. Cross-cutting
  pure logic in `helpers/`.
- **File naming**: services `*Service.js` (e.g. `ticketService.js`), models PascalCase singular
  (`Ticket.js`). Routes and controllers use the lowercase resource name, but naming is not
  perfectly consistent — some are plural (`tickets.js`, `categories.js`), some singular
  (`comment.js`, `workspace.js`), and a controller may differ from its route (route `auth.js` →
  controller `authentication.js`). Match the existing name for the resource you're touching
  rather than assuming a rule.
- **Response shape**: JSON `{ success: boolean, message: string, data?: any }`.
- **Error handling**: wrap controller bodies in try/catch. Map known errors to status codes
  (400 validation, 401 auth, 403 authz, 404 not found), default 500. Custom error classes carry
  `statusCode` (see `StatusValidationError` in `helpers/statusValidation.js`) — follow that pattern.
- **Constants** in `server/constants/` (e.g. `roles.js`). Don't hardcode role strings — import `ROLES`.

## Frontend

- **Data layer**: axios request helpers in `src/api/<resource>.js`; React Query hooks in
  `src/queries/<resource>.js`. Components call query hooks, never axios directly.
- **API base URL**: `import.meta.env.VITE_API_BASE_URL` (falls back to `/api`), configured in
  `frontend/.env`. Also used for the Socket.IO connection in `SocketContext`.
- **Query keys**: keep consistent per resource so Socket.IO invalidation (see architecture.md)
  can target them.
- **Components**: `.jsx`. shadcn-style primitives in `src/components/ui/`. Feature components
  grouped by domain (`Tickets/`, `interns/`, `analytics/`, `symphony/`, `admin/`, `Modals/`).
- **State/context**: `src/context/` (`AuthContext`, `SocketContext`, `ThemeConfigContext`).
- **Routing**: `src/routes/` — `AppRoutes.jsx`, `ProtectedRoutes.jsx`, `WorkspaceManagementRoute.jsx`.
  Add new guarded routes through these, not ad-hoc.
- **Styling**: TailwindCSS 3 + `tailwind-merge` + `clsx`. Theming via `next-themes` (light/dark).
- **Forms**: React Hook Form + Zod.

## Formatting

- Prettier is the source of truth. Run `npm run format` (or `format:check`) in the package you
  touched. ESLint configured on the server side.

## Tests

- None yet. The server `test` script is a placeholder. Do not report "tests pass" as verification —
  verify by driving the app (see workflows.md, `/verify`, `/run`).
