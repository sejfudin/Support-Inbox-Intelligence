# Architecture

## Two domains

1. **Programme management** — interns, mentors, evaluations, mentor comments, readiness flags,
   recommendations, leadership dashboards.
2. **Ticketing / project work** — workspace-scoped tickets with custom statuses, priorities,
   story points, time-in-status, threaded comments + @mentions, change history, board + table
   views, archiving, CSV export.

## Platform roles

Defined in `server/constants/roles.js` (`ROLES` = `admin | mentor | intern | leadership`).
Roles are assigned at the **user** level and drive route landing + guards.

| Role | Lands on | Capability |
|---|---|---|
| Admin | `/admin/workspaces` | Full access. Manages users, workspaces, reference data. **Bypasses workspace membership checks** for tickets/rooms. |
| Mentor | `/my-interns` | Guides interns (evaluations, comments, readiness, recommendations). Works in workspaces on tickets. Can create workspaces (becomes owner) and manage/delete the ones they own or workspace-admin — no global workspace list. |
| Leadership | `/programme` | Read-oriented stakeholder view. No ticket/workspace workflow — redirected to `/programme`. |
| Intern | `/dashboard` or `/create-workspace` | Manages own profile; works on assigned tickets in their workspace. |

**Two authorization layers** — do not conflate:
- **Platform role** (above) — `admin/mentor/intern/leadership`.
- **Workspace membership role** — `admin` / `member` — controls per-workspace management actions,
  independent of platform role. See `.claude/docs/security.md`.

## Data model (Mongoose, `server/models/`)

Core: `User`, `Workspace`, `Ticket`, `TicketStatus`, `Category`, `Comment`, `History`,
`Notification`, `RefreshToken`, `Integration`.
Programme: `InternProfile`, `Evaluation`, `MentorComment`, `ReadinessFlag`, `Recommendation`,
`Position`, `Project`, `Hub`, `Technology`, `InternshipType`, `Invitation`.
AI: `AISummary`.

- Tickets, statuses, categories, comments all carry a `workspace` ref — the scoping anchor.
- Statuses are **per-workspace and customizable** (not a global enum). See `statusService` and
  `server/helpers/statusValidation.js` / `statusSlugAliases.js`.

## Auth flow

- Login issues a short-lived **access token** (JWT) + a rotating **refresh token**.
- **Both tokens are stored in `localStorage`** (`accessToken`, `refreshToken`) — see
  `frontend/src/api/axios.js` and `src/context/AuthContext.jsx`. The access token is sent as
  `Authorization: Bearer <token>` via the axios request interceptor.
- Refresh: axios response interceptor catches 401, reads `refreshToken` from `localStorage`,
  calls the refresh endpoint, stores the new tokens, and retries queued requests
  (single-flight via `isRefreshing` + `failedQueue`). On refresh failure it clears both tokens.
- `server/middleware/auth.js` `protect` verifies the JWT, loads the user, and rejects if
  `decoded.tokenVersion !== user.tokenVersion` (logout-everywhere / rotation invalidation).
- Refresh tokens persisted (`RefreshToken` model); `tokenVersion` on `User` gates validity.
  Logic in `server/services/authService.js`.

## Real-time (Socket.IO, `server/socket/`)

- `socketServer.js` — server setup, authenticated handshake (same JWT + tokenVersion check),
  per-event rate limiting, room-level authorization.
- `events.js` — event names + emit helpers.
- `invalidationScopes.js` — room key builders that drive React Query cache invalidation:
  - `user:<id>`, `workspace:<id>`, `workspace-tickets:<id>`, `ticket:<id>`.
- Frontend consumes via `src/context/SocketContext.jsx`, invalidating query keys on events.

## Integrations

- **Groq AI** (`server/services/groqAiClient.js` + `aiSummaryService`, `ticketDescriptionGenerationService`,
  `ticketMetadataSuggestionService`; prompts in `server/prompts/`). Optional — gated on env vars.
- **GitHub App** (`server/services/githubService.js`, `autoLinkService.js`) — webhook-driven PR
  linking. RS256 JWT; installation tokens encrypted at rest (`server/helpers/crypto.js`).
- **Supabase Storage** (`server/config/supabase.js`) — attachment images, workspace logos, intern CVs.
  Server throws on startup if Supabase env vars missing.

## Recommendations (placement pipeline)

A recommendation is a mentor's placement proposal for an intern: a position + **project** (ref to
`Project`, an admin-managed reference entity — see below) + technologies, moving through a
**forward-only status lifecycle** with a separate placement outcome. Backend:
`server/{models/Recommendation.js, services/recommendationService.js,
controllers/recommendations.js, routes/recommendations.js}`. Frontend:
`frontend/src/components/interns/InternRecommendationsPanel.jsx` (data wiring + dialogs state)
composing `components/interns/recommendations/` (`RecommendationCards`, `RecommendationModals`,
`recommendationUi` — cards, view/edit/create modals, delete confirm, timeline, design tokens).

**Status lifecycle** — `recommended → interviewing → resulted`. Enforced server-side:

- A new recommendation always starts at `recommended` (create rejects anything else).
- `PATCH` rejects backward moves ("status can only move forward"); the edit modal shows earlier
  stages locked with a padlock. Setting a placement outcome forces status to `resulted`.
- **Interviewing can be skipped**: jumping straight `recommended → resulted` (or sending
  `statusDates.interviewing: null` on a resulted record) leaves interviewing dateless — rendered
  as a dashed "Skipped" step, distinct from "Pending" (not reached yet).

**Status dates** — `Recommendation.statusDates.{recommended,interviewing,resulted}` are the
authoritative, author-editable dates each stage was reached (each defaults to now when a stage
is first reached; may be backdated). Ordering is validated (`recommended ≤ interviewing ≤
resulted`) on the server, on submit, and via date-picker `min`. The append-only `History` log
(`entityType: 'recommendation'`, `statusKey`) remains the audit trail and the **fallback for
records that predate `statusDates`**; editing such a record seeds its dates from history first.

**Placement outcome** (`result.outcome`: `placed | not_placed`, note required) syncs the intern's
lifecycle status (`InternProfile.status`):

- `placed` → profile `placed`; `not_placed` → profile `ready` (back on the bench). Terminal
  states (`completed` / `discontinued`) are never touched.
- A recorded outcome can be changed but never removed.
- **Delete recomputes from the most recent remaining recommendation**: newest is `placed` →
  stays `placed`, anything else (or none left) → `ready`. Deleting also removes the record's
  history trail. The confirm dialog warns when deleting the placement that marked the intern placed.

**Roles** — writes (create/update/delete): `admin` for any intern, `mentor` only for interns they
are assigned to (`assertRecommendationWriteAccess` → `canWriteMentorData`); reads additionally
allow `leadership` (fully read-only UI — no create/edit/delete controls rendered). Everything a
mentor can do, an admin can do.

### Project (reference entity)

`Project` (`server/models/Project.js`) is the canonical list of client engagements a
recommendation can point at (title, client, description, tech tags, `status`:
`active | on_hold | completed`). Firm-global reference data, same pattern as `Technology`/
`Position` — **not** workspace-scoped despite the general "workspace-scope every resource" rule
(that rule applies to the ticketing domain, not intern/recommendation reference data).

- **Admin-only** create/edit (`requireRole(ROLES.ADMIN)`) — mentors can only select a project when
  writing a recommendation, they cannot manage the list. Managed from the "Projects" tab on
  `/admin/platform-management` (`ReferenceDataProjectsPanel`).
- Only `status: active` projects are offered in the recommendation form's project picker;
  `on_hold`/`completed` stay on existing recommendations but drop out of the picker for new ones.
- A locked sentinel project (`slug: 'unspecified'`, `isSystem: true`) exists because
  `Recommendation.project` used to be free text — the one-off
  `server/seeder/migrateRecommendationProjects.js` repoints every pre-existing recommendation at
  it (old free-text values are discarded, not preserved). The sentinel can't be edited or deleted
  and never appears in the recommendation picker.
- "Which interns are on project X" is a **derived read** (query `Recommendation` by `project`),
  not a stored roster — there is no members/roster field on `Project` by design.

## Glossary

Domain terms used throughout the code. Get these right — especially the two "admin" meanings.

| Term | What it is |
|---|---|
| **Workspace** | Multi-tenant container. Scoping anchor for tickets, statuses, categories, comments, rooms. Every ticketing operation is constrained to one. |
| **Platform role** | User-level role: `admin`, `mentor`, `intern`, `leadership` (`server/constants/roles.js`). Drives login landing + route guards. |
| **Workspace-membership role** | Per-workspace `admin` / `member`, **independent** of platform role. Controls workspace management actions. ⚠️ A platform `admin` and a workspace `admin` are *not* the same thing — don't conflate them in authz. |
| **Hub** | Physical office location (`name`, `city`, `country`) — e.g. Sarajevo, Belgrade, Skopje, Medellín. Reference data. A user belongs to a hub. |
| **InternshipType** | The programme track an intern is on — reference data keyed by `slug`. E.g. `fep`, `shadow`. |
| **FEP** | **Future Experts Program** — the standard internship track (`slug: 'fep'`). Common in seed data and intern emails (`intern.active.fep@…`). |
| **Position** | A target job role (`slug` + `name`) an intern is training toward — e.g. QA, Frontend. Reference data. |
| **Technology** | A tech skill (React, Node, …). Reference data; attached to intern profiles and readiness flags. |
| **Readiness flag** | Per-intern assessment of readiness for a specific **technology** or **position**, level `none \| learning \| ready`, recorded by a user (`ReadinessFlag`). Feeds placement decisions. |
| **Intern status** | Lifecycle of an `InternProfile`: `active → ready → placed → completed`, or `discontinued`. |
| **Primary / secondary mentor** | An intern has a primary mentor and optionally a secondary; both gate mentor access (`server/helpers/internAccess.js`). |
| **Project** | A client engagement the firm is running (e.g. "Northwind billing platform" for client "Northwind Traders") — `title/client/description/tech tags/status`. Admin-managed reference data; a recommendation refs one. Not workspace-scoped. |
| **Recommendation** | A mentor's placement recommendation for an intern (candidate pipeline). Resolving one recommendation (including a `placed` outcome) never touches the intern's other recommendations — mentors resolve each one individually. Setting the profile status to `placed` directly (via the intern update endpoint) still auto-closes any open recommendations as `not_placed`. Pipeline KPIs count distinct interns, not recommendation records. |
| **Ticket status** | **Per-workspace, customizable** — not a global enum. Statuses live in `TicketStatus`, validated via `statusValidation` / `statusSlugAliases`. |
| **Story points / time-in-status** | Ticket estimation field; time-in-status tracks how long a ticket sits in each status column. |
| **Invalidation scope** | Socket.IO room key (`user:` / `workspace:` / `workspace-tickets:` / `ticket:`) that drives React Query cache invalidation. |
