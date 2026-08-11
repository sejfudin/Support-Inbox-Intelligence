# Conventions

## Exemplars — copy these when adding something new

Follow a working example over an abstract rule. When you add a new piece, mirror the structure of:

- **A backend resource** (route + controller + service + model): follow the `ticket` slice —
  `server/routes/ticket.js`, `server/controllers/tickets.js`, `server/services/ticketService.js`,
  `server/models/Ticket.js`. Thin controller, logic in the service, workspace-scoped throughout.
- **A workspace-scoped / authz'd endpoint**: copy the `resolveWorkspaceId` +
  `assertStatusInWorkspace` pattern in `server/controllers/ticketStatuses.js` — fetch by id,
  404 if missing, reject if `resource.workspace` ≠ caller's workspace. See `.claude/docs/security.md`.
- **A role-gated endpoint**: mirror `server/routes/hubs.js`
  (`protect, requireRole(ROLES.ADMIN), handler`).
- **A frontend resource** (HTTP + data hooks): mirror `src/api/tickets.js` (axios helper) +
  `src/queries/tickets.js` (React Query hooks). Components consume the hook, never axios.
- **An error a service throws for the controller to map**: `httpError(message, statusCode)` from
  `server/helpers/httpError.js`. Don't write a local factory — that is how the codebase ended up
  with seven of them under three names and two argument orders.
- **A custom error type** (one carrying more than a status, e.g. field-level detail): follow
  `StatusValidationError` in `server/helpers/statusValidation.js` (carries `statusCode`, mapped to
  an HTTP status in the controller's catch).

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
  (400 validation, 401 auth, 403 authz, 404 not found), default 500. The status travels on the
  error, so a service never touches `res`:
  - **Plain HTTP errors** — `throw httpError('Message', 404)` from `helpers/httpError.js`. Argument
    order is `(message, statusCode)`, defaulting to 400. Never redefine it locally.
  - **Domain errors carrying more than a status** — a class, following `StatusValidationError` in
    `helpers/statusValidation.js`.
  - An error with **no** `statusCode` is by definition unexpected (a `CastError`, a driver timeout)
    and must fall through to Express as a 500 — that fall-through is what keeps internal detail out
    of responses, so don't give every error a status just to be tidy.
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
  **Colour must come from the semantic tokens** — `bg-card`, `bg-background`, `text-foreground`,
  `text-muted-foreground`, `border-border`, `border-input`, `bg-primary`, `bg-destructive`,
  `bg-muted`, `bg-accent`, `ring-ring`, `shadow-elevated{,-sm}` (defined in `src/styles/themes.css`,
  mapped in `tailwind.config.js`). Never write a literal colour — no `bg-white`, no `text-gray-500`,
  no `text-[#171b2b]`. A literal only renders correctly in one of the two themes, and it also
  opts the component out of the `data-theme` palette picker. This is not stylistic: the
  recommendations feature shipped as hardcoded hexes and rendered a white card on a dark page.
  - Two exceptions. Semantic status tints (amber / emerald / red for interviewing / placed /
    failed) have no tokens, so use the Tailwind palette **with an explicit `dark:` variant** —
    `bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300`. Alpha overlays on a
    coloured gradient (hero cards) may use `bg-white/10`, `text-white/80` — they sit on a fill
    that is dark in both themes.
  - Need a high-contrast surface that flips with the theme (tooltips)? Use `bg-foreground` +
    `text-background` rather than a fixed near-black.
- **Forms**: React Hook Form + Zod.

## Formatting

- Prettier is the source of truth. Run `npm run format` (or `format:check`) in the package you
  touched. ESLint configured on the server side.

## Tests

- Narrow. `npm test` in `server/` (Jest) covers pure helpers (`helpers/*.test.js`) plus three
  services with Mongo/Supabase mocked (`services/internCvService.test.js`,
  `services/internService.test.js`, `services/staffingRequestService.test.js`). `npm test` in
  `frontend/` (vitest) covers a handful of pure helpers under `src/helpers/*.test.js` and nothing
  else — no component is rendered in a test anywhere. There is no integration or E2E suite.
- So a passing suite says nothing about a route, query or screen. Never report those as verified
  by tests — verify by driving the app (see workflows.md, `/verify`, `/run`).
