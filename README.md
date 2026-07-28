# Support-Inbox-Intelligence

Support-Inbox-Intelligence is a full-stack internship & talent-management platform with a built-in, workspace-scoped ticketing / project-work module. It is built with a React + Vite frontend and a Node.js + Express backend, and ships with real-time collaboration, AI-assisted workflows, file storage, and a GitHub App integration.

The platform serves two connected domains:

- **Programme management** — onboard interns, assign mentors, record evaluations and mentor comments, track readiness for placement, manage recommendations, and give leadership dashboards over the full pipeline.
- **Ticketing / project work** — workspace-scoped tickets with customizable statuses, priorities, story points, time tracking, threaded comments with mentions, an audit history, board (drag-and-drop) and table views, archiving, and CSV export.

## Key features

- JWT authentication with short-lived access tokens and rotating refresh tokens
- Multi-tenant **workspaces** with members, invitations, custom logos, and per-workspace ticket statuses & categories
- **Ticketing**: board and table views, drag-and-drop, priorities, story points, time-in-status tracking, threaded comments with @mentions, full change history, image attachments, and CSV export
- **Internship programme**: intern profiles, primary/secondary mentors, evaluations, mentor comments, readiness flags, technologies, internship types, hubs, CV uploads, and documentation links
- **Recommendations & leadership dashboards**: candidate pipeline, funnels, KPIs, and placement views
- **AI assistance** (via Groq): ticket summaries, suggested replies, AI-generated ticket descriptions, metadata suggestions, and analytics summaries
- **Real-time updates** over Socket.IO (user, workspace, and ticket rooms) with authenticated handshakes and rate limiting
- **GitHub App integration**: link pull requests to tickets via webhooks
- Analytics with charts (personal and workspace level)
- Responsive, themeable UI (light/dark) built with TailwindCSS and Radix UI primitives

## User roles

The platform defines four roles (`server/constants/roles.js`). Each role lands on a different home view after login and is restricted by route guards (`frontend/src/routes`).

| Role           | Lands on                                          | Description & permissions                                                                                                                                                                                                                           |
| -------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Admin**      | `/admin/workspaces`                               | Full platform access. Manages users, workspaces, and reference data (hubs, technologies, internship types), can register new users, and has visibility over every workspace and intern. Bypasses workspace membership checks for tickets and rooms. |
| **Mentor**     | `/my-interns` (or `/dashboard` if in a workspace) | Guides assigned interns: adds evaluations and mentor comments, sets readiness flags, manages recommendations, and reviews intern profiles. Also works inside workspaces on tickets/projects.                                                        |
| **Leadership** | `/programme`                                      | Stakeholder / TA visibility (read-oriented). Sees the programme dashboard, candidate pipeline and funnels, and individual intern profiles. Has no workspace/ticket workflow — redirected to `/programme` from those routes.                         |
| **Intern**     | `/dashboard` or `/create-workspace`               | Active programme participant. Manages their own profile (technologies, CV, documentation links) and works on assigned tickets/projects within their workspace.                                                                                      |

> Roles are assigned at the user level. Workspaces additionally have their own membership roles (`admin` / `member`) that control per-workspace management actions, independent of the platform role above.

## Tech stack

- **Frontend**: React 19 + Vite 7, TailwindCSS 3, Radix UI + shadcn-style components, `@tanstack/react-query` & `@tanstack/react-table`, React Router 7, `@dnd-kit` (drag-and-drop), TipTap (rich text), Recharts (charts), Framer Motion, React Hook Form + Zod, Socket.IO client, Sonner (toasts), next-themes
- **Backend**: Node.js + Express 5, Mongoose 9 (MongoDB), Socket.IO, Multer (uploads), `sanitize-html`, bcryptjs
- **Auth**: JWT access + refresh tokens (HTTP-only cookies)
- **Storage**: Supabase Storage (image attachments, workspace logos, intern CVs)
- **AI**: Groq (HTTP API) for summaries, suggested replies, and description generation
- **Integrations**: GitHub App (webhooks + PR linking, RS256 JWT, encrypted installation tokens)
- **Dev tooling**: Vite, nodemon, ESLint, Prettier

## Repository layout

```
/frontend                 # React + Vite app
  src/
    api/                   # axios client + per-resource API helpers
    components/            # UI, tickets, interns, analytics, symphony dashboard, shadcn ui/
    pages/                 # route pages (Backlog, TicketPage, Admin*, Mentor*, fep/Leadership*)
    layouts/               # SidebarLayout, SymphonyLayout
    routes/                # AppRoutes + route guards
    context/               # Auth, Socket, ThemeConfig providers
    hooks/ helpers/ lib/   # React hooks, pure helpers, query-cache utilities

/server                   # Express API server
  index.js                # app entry (also serves the built frontend in production)
  config/                 # db.js (Mongoose), supabase.js
  routes/ controllers/    # HTTP layer
  services/               # business logic (auth, tickets, interns, AI, github, analytics, ...)
  models/                 # Mongoose models (User, Ticket, Workspace, InternProfile, ...)
  socket/                 # Socket.IO server, events, invalidation scopes
  middleware/ helpers/    # auth, role guards, uploads, crypto, validation
  prompts/                # AI prompt templates
  seeder/                 # seedDemoData.js + demo/, seed.js, seedTestingData.js, reference data

README.md
```

## Prerequisites

- Node.js >= 18
- npm
- A MongoDB instance (local or cloud)
- A Supabase project with Storage buckets (required for file uploads / server startup)
- _Optional:_ a Groq API key (AI features) and a GitHub App (PR linking)

## Environment variables

Create a `.env` file in the `server/` directory. The server **requires** the MongoDB and Supabase variables to start; the AI and GitHub variables are optional and only needed for those features.

```bash
# Core
MONGODB_URI=your_mongodb_connection_string
CLIENT_URL=http://localhost:5173      # frontend origin used by CORS and Socket.IO
SERVER_URL=http://localhost:4000      # public server URL (used for GitHub callbacks)
PORT=4000                             # optional, defaults to 4000
NODE_ENV=development

# Auth
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_jwt_refresh_secret

# Supabase Storage (required — server throws on startup if missing)
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_ATTACHMENT_BUCKET=attachment-images
SUPABASE_WORKSPACE_LOGO_BUCKET=workspace-logos
SUPABASE_CV_BUCKET=intern-cvs         # must allow application/pdf; falls back to the logo bucket
SUPABASE_BUCKET_VISIBILITY=private    # 'private' (default) or 'public'

# AI (Groq) — optional; enables AI summaries, suggestions, and descriptions
GROQ_URL=https://api.groq.com/openai/v1/responses
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=your_groq_model
GROQ_TIMEOUT_MS=15000

# GitHub App — optional; enables PR linking
GITHUB_APP_ID=your_github_app_id
GITHUB_APP_NAME=your_github_app_name
GITHUB_PRIVATE_KEY=your_github_app_private_key
GITHUB_WEBHOOK_SECRET=your_webhook_secret
GITHUB_ENCRYPTION_KEY=your_encryption_key   # encrypts stored installation tokens
```

Notes:

- `MONGODB_URI` is used by `server/config/db.js` to connect Mongoose.
- `CLIENT_URL` configures CORS in `server/index.js` and the Socket.IO server.
- `JWT_SECRET` / `JWT_REFRESH_SECRET` sign access and refresh tokens.
- Supabase URL, service-role key, attachment bucket, and workspace-logo bucket are validated at startup — the server will not boot without them.
- When the Groq variables are unset, AI endpoints respond with a "not configured" error instead of failing the whole server.

## Local development

1. Install dependencies for the backend and frontend:

```bash
cd server && npm install
cd ../frontend && npm install
```

2. Start the backend (in `server/`):

```bash
npm run dev      # nodemon index.js
```

3. Start the frontend (in `frontend/`):

```bash
npm run dev      # Vite dev server, default http://localhost:5173
```

Open the URL printed by Vite (commonly http://localhost:5173). In production, the server also serves the built frontend from `frontend/dist` with an SPA fallback, so a single `node index.js` can host both API and UI.

## Available scripts

**Frontend** (`frontend/package.json`):

- `npm run dev` — start the Vite dev server
- `npm run build` — build production assets to `dist/`
- `npm run preview` — serve the built assets locally
- `npm run format` / `npm run format:check` — Prettier write / check

**Server** (`server/package.json`):

- `npm run dev` — start with `nodemon` (auto-reload)
- `npm run start` — start with `node` (production)
- `npm run seed:demo` — wipe and rebuild a full demo dataset (interactive confirmation required)
- `npm run seed` — wipe the database and seed demo data (interactive confirmation required)
- `npm run seed:test` — seed a larger testing dataset
- `npm run seed:recommendations` — top up the placement pipeline only (additive and idempotent; `--dry-run` supported)
- `npm run seed:technologies` — upsert the Technology catalog only (non-destructive; `--dry-run` supported)
- `npm run format` / `npm run format:check` — Prettier write / check

## Seeding and admin

The `server/seeder/` directory contains three seeding scripts:

- `seedDemoData.js` (`npm run seed:demo`) — **the one to reach for.** Wipes transactional data and rebuilds one coherent dataset: four hero logins, 26 interns spread across every profile status (10 active / 6 ready / 5 placed / 3 completed / 2 discontinued, one of them a deactivated account) with ~8 weeks of attendance history, two workspaces with a populated ticket board, stand-ups in both, and a 38-recommendation placement pipeline covering every intern. **Preserves** reference data (hubs, internship types, technologies, positions) and the locked `unspecified` project. It is the only seeder that loads `.env.${NODE_ENV|development}` — the same file the server reads — so it targets the database `npm run dev` actually uses; the other two load plain `.env`, which may be a different cluster. Confirmation asks you to type the **database name**. Supports `--dry-run`, `--yes=<dbname>` for non-interactive runs, and `--checkin-today`. Fully deterministic, so re-running reproduces identical data — re-run it the morning of a demo so "today" is current.
- `seed.js` (`npm run seed`) — **destructive**: it deletes all collections, reseeds reference data (hubs, internship types, technologies), and creates a demo workspace plus default accounts. It prompts you to type `wipe` before deleting anything.
- `seedTestingData.js` (`npm run seed:test`) — seeds a richer dataset for testing (additional staff, interns across every status/programme, tickets, integrations, and invitations). Run it after `npm run seed`.

Alongside them, `seedRecommendations.js` (`npm run seed:recommendations`) is an **additive, idempotent** top-up of the placement pipeline: it inserts the recommendations from `seeder/demo/dataset.js` that are missing, and nothing else — no deletes, no updates to existing records. It resolves interns, authors and reference data by email and slug (so it works on a database whose users were created through the app), skips anything it cannot resolve with a printed reason, and re-checks each record against the intern's live profile status before writing. Because every record carries the demo seeder's deterministic `_id`, re-running inserts nothing. This is the seeding script to reach for on a shared dev database — `seed:demo` would change every user id and break everyone's open sessions. Supports `--dry-run` and `--yes=<dbname>`.

Alongside them, `seedTechnologies.js` (`npm run seed:technologies`) is a **non-destructive** catalog backfill: it upserts the entries in `seeder/defaultTechnologies.js` by slug with `$setOnInsert`, so nothing is renamed, deactivated or deleted. Run it after adding a technology — CV auto-detection can only recognize technologies that exist in the catalog, so a database seeded before the addition will keep missing them. `--dry-run` lists what would be added.

### Demo accounts

`npm run seed:demo` creates four hero accounts — **all with the password `password`**:

| Role       | Email                    | Name        |
| ---------- | ------------------------ | ----------- |
| Admin      | `admin@symphony.is`      | Sejfudin    |
| Mentor     | `mentor@symphony.is`     | Erik Muller |
| Intern     | `intern@symphony.is`     | Hamza Tuco  |
| Leadership | `leadership@symphony.is` | Enis Kudo   |

It also creates two background mentors (`boris.petrovic@`, `natasa.ilic@symphony.is`) and 26 interns at `firstname.lastname@symphony.is`, all with the same password — except `goran.stankovic@symphony.is`, whose account is deliberately deactivated so the disabled-user state is demo-able (login is rejected; the user still appears in the admin directory).

`npm run seed` creates:

| Role   | Email             | Password    |
| ------ | ----------------- | ----------- |
| Admin  | `admin@test.com`  | `admin123`  |
| Mentor | `mentor@test.com` | `mentor123` |

`npm run seed:test` adds Symphony staff and interns — **all of these use the password `password`**:

| Role       | Email                                                                       | Password   |
| ---------- | --------------------------------------------------------------------------- | ---------- |
| Leadership | `leadership@symphony.is`                                                    | `password` |
| Leadership | `leadership2@symphony.is`                                                   | `password` |
| Admin      | `admin@symphony.is`                                                         | `password` |
| Mentor     | `mentor.sarajevo@symphony.is`                                               | `password` |
| Mentor     | `mentor.belgrade@symphony.is`                                               | `password` |
| Mentor     | `mentor.novisad@symphony.is`                                                | `password` |
| Intern     | `intern.active.fep@symphony.is` (and other `intern.*@symphony.is` accounts) | `password` |

⚠️ Never run the seeders against a production database — they clear existing data.

## Authentication and security notes

- Short-lived JWT access tokens plus rotating refresh tokens (see `server/services/authService.js`); refresh tokens are persisted and tracked via a `tokenVersion`.
- Socket.IO connections are authenticated from the JWT handshake and validated against the current `tokenVersion`, with per-event rate limiting and room-level authorization.
- User-supplied HTML (comments, rich text) is sanitized with `sanitize-html`.
- Stored GitHub installation tokens are encrypted at rest using `GITHUB_ENCRYPTION_KEY`.

## Tests

There are no automated tests in this repository yet (`server`'s `test` script is a placeholder). Adding unit and integration tests for backend services and React components is a recommended next step.

## Contributing

Feel free to open issues and pull requests. For sizable changes, please open an issue first to discuss the approach.

## License

This repository does not specify a license. If you plan to open-source it, add a `LICENSE` file (e.g., MIT) to clarify terms.
