# Team Handbook — Support-Inbox-Intelligence

> Quick reference guide for roles, permissions, and contribution conventions on this project.
> Shared with the whole team — keep it in sync with the code (see the note in root `CLAUDE.md`).

---

## 1. Roles & Permissions

**Admin**
- Only role with the admin dashboard as their landing page — reports on the workspace they're currently in (switch it from the sidebar): who's present today, each intern's open workload and monthly attendance, and today's standup coverage. The two placement cards are the exception: they show the latest placements across every workspace, not just the current one
- Creates, deletes, and views all workspaces
- Creates user accounts, invites new users (mentors, interns, leadership, other admins), and changes their role
- Views and edits all intern profiles
- Only role that manages reference data (hubs, technologies, internship types)
- Doesn't see programme-wide statistics
- Only role that can create, edit, and delete recommendations — mentors have no access at all now, not even read
- Only role that can assign a specialization (confirm an intern's main or secondary declared position and pair them with a dedicated mentor) — mentors receive the pairing but never create or manage it, and have no view of the Specialization tab
- Only role that can reassign a specialization to the intern's other position, change the specialization mentor, or clear a specialization entirely
- Only role that can add evaluations to an intern (periodic assessment: technical skill, communication, ownership, growth)
- Only role that can set readiness (by technology or by position) for an intern
- Only role that can see the attendance roster (all interns' attendance) — an intern's own check-in stays theirs
- Only role that can view the per-workspace Daily standup reporting dashboard (who reported today, calendar-month coverage grid, open blockers) — a read-only compliance view, not a data-entry surface
- Only role that can edit the internal CV link on an intern profile (a mentor can still view it, just not edit it)
- Only role that can change an intern's lifecycle status (active/ready/placed/completed/discontinued) — even for an intern with an assigned mentor
- Manages documentation links on intern profiles
- Works with tickets like everyone else, plus can cross workspace boundaries (view tickets/analytics of any workspace, not just their own)
- Manages the GitHub integration of any workspace (connect/disconnect the repo)
- Can edit workspaces (add a workspace image, add backlog statuses, add categories like bug/feature/etc.)

**Leadership**
- Read-only, no write permissions anywhere
- Sees all interns and all their profiles (not just assigned ones, unlike a mentor)
- Sees all recommendations (created exclusively by admin), but can't create/edit them
- Sees programme-wide statistics, the funnel/pipeline dashboard
- Sees a read-only "Projects" view (`/projects`): every client project with who's placed on it,
  who's currently in selection (recommended/interviewing), technology demand across projects, and
  each project's full outcome history — no recommend/edit actions anywhere
- No access to the workspace/ticket side of the platform (project work)
- No access to admin panels (users, workspaces, reference data)

**Mentor**
- Sees only their assigned interns (primary or secondary mentor) — and only Overview, mentor notes, and documentation links
- Adds mentor notes (free text, picks who can see it) only for their own interns
- Can't see or add evaluations (periodic progress assessment) — admin-only now
- Can't see or set readiness (by technology or position) — admin-only now
- Can't see or create recommendations, neither per-intern nor on the standalone "Recommendations" page — admin-only now
- Can't see or manage the Specialization tab, but does get assigned-mentor access to an intern once paired as their specialization mentor
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
- Sees only their own readiness status, and not mentor notes
- Sees their own evaluation scores and periods on their dashboard — but not the written notes on them
- Sees their own recommendation on their dashboard: which project, which stage, interview dates, and the final result — but not the recommendation write-up, interviewer feedback, or the reasoning behind the decision
- Sees no one else's recommendations or evaluations
- Can declare an optional secondary position alongside their main one; once an admin assigns a specialization, their confirmed position locks (read-only, badged) and their secondary stays editable
- Works on tickets/projects within their workspace — creates tickets, comments, tracks time, uses AI assistance, sees their workspace's analytics
- No access to other interns', mentors', or admin/leadership data or functions
- **Interesting:** can't edit their own documentation links either — only Admin, Leadership, and the assigned mentor can; not even the profile owner (the intern)

> **Note:** workspace access follows workspace *membership*, not a leftover setting. Mentors and
> interns only see a workspace's tickets, board, statuses, categories, dailies and member list
> while they are an active member of it. Someone who was removed from a workspace, or whose role
> changed away from mentor/admin, loses that workspace immediately and lands on the "no workspace"
> state until they accept an invitation to another one. Admins and mentors can still reach any
> workspace, as above.

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

_Created 2026-07-09, updated 2026-07-22 for the mentor-role narrowing (recommendations,
evaluations, readiness, attendance, internal CV editing, and status changes moved to admin-only).
This is a snapshot of the code's state — verify against the code before using anything here as the
basis for an important decision._
