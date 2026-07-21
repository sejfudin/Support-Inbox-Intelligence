# server/ — Node.js + Express 5

CommonJS. Express 5, Mongoose 9 (MongoDB), Socket.IO, Multer, sanitize-html, bcryptjs, JWT.
`index.js` is the entry (also serves built frontend in production).

Root rules and shared conventions apply — see ../CLAUDE.md, ../.claude/docs/conventions.md,
and especially ../.claude/docs/security.md (authz is the top risk here).

## Layout

- `routes/` → `controllers/` → `services/` → `models/`. Thin controllers, logic in services.
- `middleware/` — `auth.js` (`protect`), `requireWorkspaceManager.js`, `role` (file exporting
  `requireRole(...roles)`), `upload.js`.
- `helpers/` — pure cross-cutting logic: `workspaceAuthz.js`, `internAccess.js`, `crypto.js`,
  `statusValidation.js`, `statusSlugAliases.js`, `commentMention.js`, `aiValidationRules.js`,
  `slugify.js`, `taskExtractor.js`.
- `socket/` — `socketServer.js`, `events.js`, `invalidationScopes.js`.
- `config/` — `db.js` (Mongoose), `supabase.js`. `constants/` — `roles.js`.
- `prompts/` — Groq AI prompt templates. `seeder/` — seed scripts (destructive; see workflows).
- `repository/` — thin data-access modules (currently sparse; most access is service → model).

## Env files

`index.js` loads `.env.${NODE_ENV}` (defaults to `.env.development`) — that's the database
`npm run dev` actually uses. Older one-off scripts under `seeder/` instead load plain `.env`,
which can point at a **different** database (both are dev clusters here, but don't assume that's
always true). When writing a new seeder/migration script, load env the same way `index.js` does
so it hits the database you're actually testing against — don't copy the plain-`.env` pattern.

## Rules specific to server

- **Every route: `protect` first**, then role/workspace guards, then upload, then controller.
  Example: `router.post('/', protect, requireRole(ROLES.ADMIN), createHub);`
- **Workspace-scope every resource op.** Fetch-by-id then assert `resource.workspace` matches the
  caller's resolved workspace. Use `helpers/workspaceAuthz.js`. See ../.claude/docs/security.md.
- **Import `ROLES` from `constants/roles.js`** — never hardcode `'admin'` etc.
- **Response shape** `{ success, message, data? }`. try/catch every controller; custom errors
  carry `statusCode`.
- **Sanitize rich-text HTML** (rendered client-side via `dangerouslySetInnerHTML`, e.g. ticket
  descriptions) with `sanitize-html` before persisting — see `helpers/htmlSanitize.js`. Plain-text
  fields (comments) are stored verbatim and made safe by React's text-node escaping at render; do
  **not** run them through an HTML sanitizer (it entity-encodes `&`/`<`/`>` into stored data).
- **Never** run seeders against non-local DBs. Never commit `.env`.
- Emit Socket.IO invalidation via `socket/invalidationScopes.js` keys so the frontend cache updates.
- Run `npm run format` before finishing.
