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
- **The id of a user you were handed**: `resolveUserId(user)` from
  `frontend/src/helpers/userIdentity.js`. The same value arrives as `_id` (API payloads), `id`
  (`/auth/me`) or a bare string (an unpopulated ref), so don't spell the fallback chain out at
  the call site — that is how eleven copies of it appeared, three of them wrapped in a private
  helper with a different name.

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
  - **The catch block itself** — `handleControllerError` from `helpers/controllerError.js`, imported
    as `handleError`. It maps the three cases above and emits the documented envelope. Don't write a
    local copy: there were eleven, in six shapes that disagreed on `success: false`, on whether a
    Mongoose `ValidationError` answered 400 or 500, and on passing `error.data` through.
    `attachmentImage.js` is the one deliberate exception — it serves image bytes and has no `next`.
- **Constants** in `server/constants/` (e.g. `roles.js`). Don't hardcode role strings — import `ROLES`.
- **Projecting a user** — `userSelect(...extras)` from `constants/userSelect.js`, never a literal.
  `populate('creator', userSelect())`, `select: userSelect('role', 'hub')`. It always carries the
  fields needed to *display* a person, the avatar included, and the caller names only what it needs
  on top. Sixty hand-written variants of `'fullname email role'` is how a new display field ends up
  on some screens and not others. If you hand-build a DTO that reshapes a user, carry `avatarUrl`
  yourself — a projection constant cannot reach inside a `.map()`.

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
- **A user setting is a row in a table, not a new hook.** `ThemeConfigContext`'s
  `DOM_PREFERENCES` / `VALUE_PREFERENCES` and `server/constants/userPreferences.js` are the only
  two places that enumerate the preferences; a new one costs a row in each (plus a CSS block for
  an `<html>` attribute). Read and write it through `hooks/useStoredPreference.js` so it caches,
  syncs to the user record and reaches the other components holding the same key.
  A per-device setting is still a row — it carries `scope: PREFERENCE_SCOPE.DEVICE`, which
  `ACCOUNT_PREFERENCES` filters out, and costs no row on the server. Reach for it only when the
  right answer genuinely differs per machine (`uiScale` follows screen size; `desktopNotifications`
  follows a browser permission granted per browser). Skipping the table instead is the thing to
  avoid: a key enumerated nowhere is a key the next reader cannot find.
  See architecture.md → "UI preferences" before adding one.
- **Routing**: `src/routes/` — `AppRoutes.jsx`, `ProtectedRoutes.jsx`, `WorkspaceManagementRoute.jsx`.
  Add new guarded routes through these, not ad-hoc.
- **Every route owns its browser-tab title.** `routes/RouteTitle.jsx` applies a baseline from the
  path map in `helpers/pageTitle.js` on each navigation — add an entry there with the new route,
  wording it like the nav label the user clicked. A page that shows one named record (ticket,
  workspace, intern, project) overrides it with that record's name via `useDocumentTitle(name)`,
  passing a falsy value while the data loads so the baseline stands instead of a flash of
  "undefined". The hook is a passive effect and the baseline a layout effect, which is what makes
  the page's title win regardless of mount order — don't switch either. A page that opens the
  ticket details modal calls `useTicketModalTitle({ ticketId, isOpen })` instead: the modal is page
  state, so nothing in the URL changes and the page has to restore its own title on close.
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
    `bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300`. Content on a fill that
    is dark in **both** themes (hero cards, the What's New tour panel) may use literal white —
    alpha overlays like `bg-white/10`, `text-white/80`, and also a solid `bg-white` +
    `text-slate-900` for a button that must stay light on that fill. A token would be wrong here,
    not merely unnecessary: `bg-foreground` flips to near-black in the dark theme and would render
    a dark button on a dark panel.
  - Need a high-contrast surface that flips with the theme (tooltips)? Use `bg-foreground` +
    `text-background` rather than a fixed near-black.
- **Page chrome comes from the flat-shell classes** in `src/index.css`, not from ad-hoc Tailwind:
  `.app-page-header` (the header band, bleeds out of `.app-page-content`'s gutter), `.app-crumb`,
  `.app-title`, `.app-subtitle`, `.app-card` + `.app-card-head` + `.app-card-title`,
  `.app-table-head`, `.app-table-scroll`, `.app-chip`, `.app-stat-value`. Constants (12px radii,
  34px controls, 38px table headers, the 10.5–13.5px type steps) come from the UI-overhaul spec in
  `Attendance page redesign/handoff/TOKENS.md`; the colours are this app's semantic tokens.
  - **`.app-panel` / `.app-panel-soft` are the pre-overhaul rounded, shadowed surfaces and are now
    used only by the three dashboards** (`AdminDashboardPage`, `InternDashboardPage`,
    `UserDashboard` and their `components/*/dashboard/*`), which the overhaul deliberately left
    alone. Anywhere else, a new surface is `.app-card`.
- **Every page header is `<PageHeading crumb title subtitle actions />`** — one flat band, closed
  by a hairline. There is no kicker badge any more: the eyebrow line is the breadcrumb, and it
  names the sidebar group the page lives in (Workspace / Internship / Admin / Account / Mentoring /
  Access), matching the mockup.
- **A wide table carries its own `min-w-[…]` plus an `.app-table-scroll` wrapper**, so it scrolls
  inside its card instead of pushing the page sideways — that is what keeps a name column from
  being squeezed to nothing on a narrow window.
- **A pane that scrolls says so: wrap it in `ScrollFade`** (`components/ui/scroll-fade.jsx`) rather
  than leaving a bare `overflow-y-auto`. It measures the viewport and fades the content at whichever
  edge has more past it, so the fades stay off when nothing overflows. Overlay scrollbars (the macOS
  default) are invisible until a scroll gesture starts, which leaves an overflowing pane reading as
  merely cut off — the last row looks like the end of the list. Put the height cap and
  `overflow-y-auto` on `viewportClassName`, and pass `fadeClassName` naming the surface the pane
  actually sits on (`from-card` inside a modal or card); the default `from-background` shows as a
  smudge anywhere else. Used by the staffing-request lists and the recommendation modals.
- **A layout that has to respond to the sidebar rail reads `data-sidebar-state`**, which
  `SidebarProvider` stamps (`expanded` / `collapsed`) on the shell wrapper above both the rail and
  the content column. Override a token under it and let the cascade do the work — never a JS
  resize listener or a measured width. The board's `--board-col-max` is the worked example: the
  column ceiling lifts when the rail collapses so the freed width lands in the columns.
- **Loading is one pattern, not a choice per screen.** A skeleton says what shape is coming and the
  brand mark says it is still coming, and they appear together: `LoadingOverlay`
  (`components/ui/loader.jsx`) wraps the skeleton and lays the mark on top behind a translucent,
  blurred veil. Only where the result has no shape to imitate — app boot, a record page that
  branches on its own data, a modal body — does the mark stand alone (`Loader`, with
  `variant="screen" | "panel" | "overlay"` or plain inline). The three-state trap to avoid is
  mark → skeleton → content: if a loader lifts onto a screenful of skeletons it was never covering
  the load, and the fix is to render the page *under* the loader rather than instead of it (see
  `routes/ProtectedRoutes.jsx`). Every loader is gated through `useLoaderHold` — except a wait the person opened by clicking (the
  ticket modal, the notifications dropdown), where a floor is a toll on the click. It holds it for
  `MIN_VISIBLE_MS` and never lifts before the data arrives — wrap the query's own flag at the
  source so every use in the file inherits the hold, and hand it the query's `isError` as
  `release` so a failed load doesn't hold the mark over its own error banner. The floor is a
  first-arrival effect: paging, filtering or stepping a month re-enters `isPending` on a screen
  that has already introduced itself, and charging each of those another 1.5s is a toll rather
  than a rhythm. Button spinners (`Loader2`) are a different sentence — "your click is working" —
  and stay as they are.
- **Forms**: React Hook Form + Zod.

## Formatting

- Prettier is the source of truth. Run `npm run format` (or `format:check`) in the package you
  touched. ESLint configured on the server side.

## Tests

- Narrow, and colocated: a test sits beside the module it covers as `*.test.js`. `npm test` in
  `server/` (Jest) covers pure helpers under `helpers/` plus the pure exports of some
  `services/` modules, with Mongo and Supabase mocked. `npm test` in `frontend/` (vitest) covers
  pure helpers under `src/helpers/`, pure functions a hook exports, and pure presentation
  predicates beside the components that use them. No component is rendered in a test anywhere, no
  route or socket is exercised, and there is no integration or E2E suite. `ls **/*.test.js` for the
  current set.
- So a passing suite says nothing about a route, query or screen. Never report those as verified
  by tests — verify by driving the app (see workflows.md, `/verify`, `/run`).
