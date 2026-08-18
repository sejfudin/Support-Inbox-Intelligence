# frontend/ — React 19 + Vite

ESM. React 19, Vite 7, TailwindCSS 3, Radix UI + shadcn-style components, React Router 7,
TanStack Query + Table, Socket.IO client, TipTap, Recharts, Framer Motion, dnd-kit, RHF + Zod.
Toasts are `sonner`; check `package.json` before adding a dependency — the common needs are
already covered.

Root rules and shared conventions apply — see ../CLAUDE.md and ../.claude/docs/conventions.md.

## Layout (`src/`)

- `api/` — axios client (`axios.js`) + one helper module per resource. Only place that talks HTTP.
- `queries/` — TanStack Query hooks per resource. Components consume these, never `api/` directly.
- `components/` — one subdirectory per feature area (tickets, interns, symphony, attendance,
  dailies, projects, analytics, admin, …) plus shared `ui/` (shadcn primitives), `Modals/`,
  `Skeletons/`, `columns/`. Loose `.jsx` files at the top level are cross-feature widgets.
- `pages/` — route pages. `layouts/` — `SidebarLayout`, `SymphonyLayout`.
- `routes/` — `AppRoutes`, `ProtectedRoutes`, `WorkspaceManagementRoute`. Add guarded routes here.
- `context/` — `AuthContext`, `SocketContext`, `ThemeConfigContext`.
- `hooks/`, `helpers/`, `lib/`, `constants/`, `styles/`.

## Rules specific to frontend

- **Never call axios from a component.** Go component → `queries/` hook → `api/` helper.
- **Both `accessToken` and `refreshToken` live in `localStorage`**; the axios interceptor
  attaches the access token and handles 401 refresh (single-flight, clears both on failure).
  Don't reimplement auth headers or token storage. A request that genuinely cannot go through
  axios — today only the `keepalive` unload flush in `api/userPreferences.js`, which must
  outlive the document — still builds its header with `authorizationHeader()` from
  `api/axios.js` and reads the key names from `lib/authStorage.js`.
- **Query keys must stay consistent per resource** — Socket.IO events invalidate by key
  (`user:`, `workspace:`, `workspace-tickets:`, `ticket:`). Breaking a key breaks live updates.
- **A new route needs a tab title** — add it to the map in `helpers/pageTitle.js`; if the page
  shows one named record, also call `useDocumentTitle(name)`. See conventions.md.
- Use `src/components/ui/` primitives + Tailwind; theme via `next-themes` (support light + dark).
- Forms: React Hook Form + Zod schemas.
- Run `npm run format` before finishing.
