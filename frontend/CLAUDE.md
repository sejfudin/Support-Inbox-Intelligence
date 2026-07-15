# frontend/ — React 19 + Vite

ESM. React 19, Vite 7, TailwindCSS 3, Radix UI + shadcn-style components, React Router 7,
TanStack Query + Table, Socket.IO client, TipTap, Recharts, Framer Motion, RHF + Zod.

Root rules and shared conventions apply — see ../CLAUDE.md and ../.claude/docs/conventions.md.

## Layout (`src/`)

- `api/` — axios client (`axios.js`) + one helper module per resource. Only place that talks HTTP.
- `queries/` — TanStack Query hooks per resource. Components consume these, never `api/` directly.
- `components/` — feature groups (`Tickets/`, `interns/`, `analytics/`, `symphony/`, `admin/`,
  `Modals/`, `Skeletons/`, `columns/`, `reference-data/`, `register/`) + `ui/` (shadcn primitives).
- `pages/` — route pages. `layouts/` — `SidebarLayout`, `SymphonyLayout`.
- `routes/` — `AppRoutes`, `ProtectedRoutes`, `WorkspaceManagementRoute`. Add guarded routes here.
- `context/` — `AuthContext`, `SocketContext`, `ThemeConfigContext`.
- `hooks/`, `helpers/`, `lib/`, `constants/`, `styles/`.

## Rules specific to frontend

- **Never call axios from a component.** Go component → `queries/` hook → `api/` helper.
- **Both `accessToken` and `refreshToken` live in `localStorage`**; the axios interceptor
  attaches the access token and handles 401 refresh (single-flight, clears both on failure).
  Don't reimplement auth headers or token storage.
- **Query keys must stay consistent per resource** — Socket.IO events invalidate by key
  (`user:`, `workspace:`, `workspace-tickets:`, `ticket:`). Breaking a key breaks live updates.
- Use `src/components/ui/` primitives + Tailwind; theme via `next-themes` (support light + dark).
- Forms: React Hook Form + Zod schemas.
- Run `npm run format` before finishing.
