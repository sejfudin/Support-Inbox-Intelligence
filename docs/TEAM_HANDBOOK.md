# Team Handbook — Support-Inbox-Intelligence

> Quick reference guide for roles, permissions, and contribution conventions on this project.
> Shared with the whole team — keep it in sync with the code (see the note in root `CLAUDE.md`).

---

## 1. Roles & Permissions

**Admin**
- Creates, deletes, and views all workspaces
- Creates user accounts, invites new users (mentors, interns, leadership, other admins), and changes their role
- Views and edits all intern profiles
- Sole owner of reference data (hubs, technologies, internship types)
- Doesn't see programme-wide statistics
- Sole role that can create, edit, and delete recommendations — mentors have no access at all now, not even read
- Sole role that can add evaluations to an intern (periodic assessment: technical skill, communication, ownership, growth)
- Sole role that can set readiness (by technology or by position) for an intern
- Sole role that can see the attendance roster (all interns' attendance) — an intern's own check-in stays theirs
- Sole role that can edit the internal CV link on an intern profile (a mentor can still view it, just not edit it)
- Sole role that can change an intern's lifecycle status (active/ready/placed/completed/discontinued) — even for an intern with an assigned mentor
- Manages documentation links on intern profiles
- Works with tickets like everyone else, plus can cross workspace boundaries (view tickets/analytics of any workspace, not just their own)
- Manages the GitHub integration of any workspace (connect/disconnect the repo)
- Can edit workspaces (add a workspace image, add backlog statuses, add categories like bug/feature/etc.)

**Leadership**
- Read-only, no write permissions anywhere
- Sees all interns and all their profiles (not just assigned ones, unlike a mentor)
- Sees all recommendations (created exclusively by admin), but can't create/edit them
- Sees programme-wide statistics, the funnel/pipeline dashboard
- No access to the workspace/ticket side of the platform (project work)
- No access to admin panels (users, workspaces, reference data)

**Mentor**
- Sees only their assigned interns (primary or secondary mentor) — and only Overview, mentor notes, and documentation links
- Adds mentor notes (free text, picks who can see it) only for their own interns
- Can't see or add evaluations (periodic progress assessment) — admin-only now
- Can't see or set readiness (by technology or position) — admin-only now
- Can't see or create recommendations, neither per-intern nor on the standalone "Recommendations" page — admin-only now
- Can't see the attendance roster (intern attendance overview) — an intern's own check-in is untouched
- Can see the CV link on an intern's profile, but can't edit it — admin-only now
- Can't change an intern's lifecycle status (active/ready/placed/completed/discontinued), even for their own assigned intern — admin-only now
- Can manage documentation links on an intern profile
- Can't create workspaces
- No access to programme-wide statistics
- Also works on tickets/projects within the workspace they belong to, independent of the mentor role — creates tickets, comments, tracks time, exports to CSV, uses AI assistance (summaries, description suggestions), and sees their workspace's analytics

**Intern**
- Sees and edits only their own profile
- Declares their own technologies
- Uploads their own CV
- Sees only their own readiness status, not their evaluations or mentor notes
- Doesn't see recommendations at all (not even their own)
- Works on tickets/projects within their workspace — creates tickets, comments, tracks time, uses AI assistance, sees their workspace's analytics
- No access to other interns', mentors', or admin/leadership data or functions
- **Interesting:** can't edit their own documentation links either — only Admin, Leadership, and the assigned mentor can; not even the profile owner (the intern)

> **Note:** being the owner or "admin" member of a specific workspace is a separate, workspace-level
> role — entirely independent from the platform role (admin/mentor/leadership/intern). Any user
> invited to a workspace (mentor or intern) can gain that status and thereby the right to manage
> that workspace: invite/remove members, change the logo, categories, and ticket statuses,
> connect/disconnect the GitHub repo. It has nothing to do with whether someone is a mentor or
> intern on the platform.

---

## 2. Contribution Guidelines

**Working on the project**
- Install deps separately: `cd server && npm install`, `cd frontend && npm install`
- Run in two terminals: `server/` → `npm run dev` (API + Socket.IO, `:4000`); `frontend/` → `npm run dev` (Vite, `:5173`)
- Config comes from `server/.env` — never commit it, never commit secrets or tokens
- Never run the seeders (`npm run seed`) against a non-local database — they wipe all collections
- No automated test suite exists yet — verify a change by actually running the app, don't claim "tests pass"
- Run `npm run format` in the package you touched before opening a PR

**Branches**
- Branch name: `type/description` or `type/number-description` (e.g. `feature/116-document-links`)
- Types in use: `feature/`, `feat/`, `fix/`, `bug/`, `refactor/`, `docs/` (feature/feat are used interchangeably, not standardized)
- All branches go as a PR into the `development` branch. `master` is production; `staging` also exists.

**Commit messages**
- Mostly styled as `feat: ...`, `fix: ...`, `docs: ...`, `refactor(scope): ...`, but not strictly enforced — plain descriptive messages also happen.

**PR process**
- Feature branch → Pull Request on GitHub → merge into `development`
- No PR template, no formally defined review process

**Suggestion:** if this ever gets formalized, it's worth adding a `CONTRIBUTING.md` and standardizing `feature/` vs `feat/`.

---

## 3. My Observations — Where Role Logic Feels Inconsistent

This is my personal assessment, not a description of how the system currently works (that's
above) — these are discussion points, not decisions. Split into three groups.

### A) Permission design that feels backwards or inconsistent

- **Only Admin can create workspaces, even though Mentor runs them.** The mentor is the one actually doing operational work in a workspace with their interns, but has to ask an admin to open a new one for every new team/project. It would make more sense for a mentor to create their own workspace (and automatically become its owner), while admin keeps oversight/deletion rights over all of them.
- **A mentor doesn't even know other workspaces exist.** Right now a mentor only knows about workspaces they're a member of — there's no basic overview of "which teams exist" on the platform. When deciding which team to place a new intern in, a mentor can't judge that themselves and has to ask an admin. At least a name/description list (without ticket access) would make sense.
- **A mentor can't invite/register an intern themselves.** The mentor later handles everything for "their" intern (mentor notes, documentation links), but the intern has to be added to the system by an admin. Adding an intern to a team feels like a natural mentor action, not an administrative one.
- **An intern never sees their own evaluations.** It's understandable that mentor notes might be "internal," but the progress scores themselves (technical skill, communication, etc.) could help the intern know where they stand. Currently this is completely closed off.
- **An intern can't edit the documentation links on their own profile.** Only Admin, Leadership, and the assigned mentor have that right — not even the profile owner (the intern) can. If these links are meant for the intern (e.g. a link to their portfolio/repo), it would make more sense for the intern to be able to edit them themselves.
- **Platform role and workspace role are two completely separate systems that are easy to conflate.** Someone can be a "Mentor" on the platform while being a plain "member" in one workspace and an "admin" in another — these are two independent things. Worth keeping in mind whenever the team talks about "permissions," since it's easy to mix up the platform role with the workspace role.

### B) Things that currently work but, in my view, shouldn't

- Any logged-in user (any role) can open any workspace's details — including its member list — if they know or guess its ID, even if they're not a member of that workspace at all.
- The same applies to an individual ticket and its change history — if a user knows a ticket's ID, they can open/edit/archive it regardless of whether they belong to that workspace.
- The same applies to an entire workspace's analytics — someone else's workspace analytics can be viewed with just the ID, with no membership check.
- Any user with the Leadership role (and a mentor who isn't yet in any workspace) can currently pull the list of **all** users on the platform, not just their own team.

These (group B) are technical gaps, not design decisions — worth treating as bugs to fix, not as a "feature" to debate.

### C) The reverse case — something Admin can't do, but by rights should be able to

- An admin with no personal workspace (e.g. a plain admin account never invited into any workspace) **can't even open** an individual workspace's page, its settings, or the admin backlog view — the app automatically redirects them to the "create a workspace" screen before it even checks whether they're an admin. The server would otherwise allow access (admin has the right to manage any workspace), but the frontend route in practice blocks them from getting there. This is a bug in the order of checks on the route, not an intentional restriction.

---

_Created 2026-07-09, updated 2026-07-22 for the mentor-role narrowing (recommendations,
evaluations, readiness, attendance, internal CV editing, and status changes moved to admin-only).
This is a snapshot of the code's state — verify against the code before using anything here as the
basis for an important decision._
