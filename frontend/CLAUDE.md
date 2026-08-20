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
- **A person is drawn with `ui/user-avatar.jsx` (`UserAvatar`) and nothing else.** It renders their
  profile picture when they have one and their hashed-colour initials when they do not. Do not
  hand-roll the circle from `getAvatarColor` + `getInitials` — 26 components used to, which is why
  a photo would have shown on some screens and a monogram on others. Pass `user` when you have the
  record, `name` when a component only ever received a string, and pin an odd size or tint with
  `className` (twMerge lets it win). For several people overlapped with tooltips, use
  `components/Avatar.jsx`, which is built out of it. Initials come from `getInitials` in
  `helpers/userIdentity.js` — the one implementation; there were three, and they disagreed.
- **Payload mappings that pick user fields by hand must name `avatarUrl`.** A `.map()` building
  `{ fullName, email, role }` silently drops it and the screen falls back to initials — see the
  comment in `pages/AdminUsersPage.jsx`.
- **Every wait is a skeleton with the brand mark over it.** `LoadingOverlay` from
  `components/ui/loader.jsx` wraps the skeleton and lays `Loader` on top behind a translucent,
  blurred veil — the skeleton says what shape is coming, the mark says it is still coming. Where
  there is no shape to draw (app boot, a record page that branches on its data, a modal body) use
  `Loader` alone: `variant="screen"` for the viewport, `panel` inside a container, `overlay` over a
  positioned parent, plain for inline. Inside a `tbody` a `div` is illegal — put `relative` on the
  scroll box and render `<Loader variant="overlay" />` as the table's sibling.
- **Gate every loader through `useLoaderHold`, and pass it the query's `isError`.** It keeps the
  mark up for `MIN_VISIBLE_MS` (1.5s) once shown and never lifts before the data is in, so the app
  has one loading rhythm. Wrap the query's own flag at the source — `const { isPending:
isPendingRaw, isError } = useX(); const isPending = useLoaderHold(isPendingRaw, { release:
isError });` — so every use in the file inherits it and no site can forget. Without `release` a
  failed query holds the mark over the error banner it just rendered. The floor applies to the
  first arrival only; paging, filtering and stepping a month re-enter `isPending` on a screen that
  is already up, and those are not charged again. A release also counts as a turn on screen, so a
  query that fails and then succeeds on retry is not charged the floor a second time.
- **One exception to the gate: a wait the person opened by clicking.** `Modals/TicketDetailsModal`
  and `NavbarNotifications` render their loader off the raw query flag on purpose — a floor
  on a click the person is waiting through is a toll, not a rhythm. Both put their real frame on
  screen immediately and let only the contents be pending. Nothing else qualifies: a page the
  person navigated to is gated.
- **The boot wait is two splashes, and both have to be edited together.** The React splash
  (`routes/ProtectedRoutes.jsx`) cannot cover the wait for the bundle that defines it, so
  `index.html` carries a static `#boot-splash` with its own copy of the mark and the animation —
  paint starts before any JS runs, and `createRoot().render()` clears it on React's first paint.
  The copy is intentional (reusing `.logo-loader` would tie first paint to the render-blocking
  stylesheet, and in dev that CSS arrives through the very bundle being waited on). If you change
  the petal stagger, the timing curve, the `lg` size or the label, change it in **both**
  `src/index.css` and `index.html` — they diverge silently, and the symptom is a visible blink at
  the handover rather than an error.
- **A skeleton's own spacing goes in `contentClassName`, not `className`.** On `LoadingOverlay`,
  `className` styles the positioned box and `contentClassName` styles the wrapper the skeletons sit
  in — `space-y-*` on the outer one lands on the inert wrapper and an absolutely positioned mark,
  and silently does nothing.
- **`<Loader variant="overlay" />` needs a `relative` parent that does not scroll.** Put the class
  on a wrapper _around_ the scroll box, never on the scroll box itself: an absolutely positioned
  child of a scroller is sized to its visible width and scrolls away with the content, so a wide
  table ends up half-covered.
- **Spinners are for actions, not for arriving pages.** `Loader2` inside a button means "your click
  is working"; it stays. Don't convert those, and don't add new ones for page loads.
- Forms: React Hook Form + Zod schemas.
- Run `npm run format` before finishing.
