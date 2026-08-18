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
- Only role that manages reference data (hubs, positions, technologies, internship types) —
  positions (specializations like "Frontend Engineer") and technologies (concrete tools like
  "React") are kept as separate catalogs on purpose
- Only role that adds and edits projects — and must pick each project's type (client or internal) when creating it; the type can be changed later
- Doesn't see programme-wide statistics
- Only role that can create, edit, and delete recommendations — mentors have no access at all now, not even read
- Only role that can assign a specialization (confirm an intern's main or secondary declared position and pair them with a dedicated mentor) — mentors receive the pairing but never create or manage it, and have no view of the Specialization tab
- Only role that can reassign a specialization to the intern's other position, change the specialization mentor, or clear a specialization entirely
- Only role that can add evaluations to an intern (periodic assessment: technical skill, communication, ownership, growth) — note the intern now reads their own scores **and the written notes** on their My Progress page, so write them as feedback addressed to the intern
- Only role that can set readiness (by technology or by position) for an intern — the intern now sees their own levels, and who set them, on My Progress
- Only role that can see the attendance roster (all interns' attendance) — an intern's own check-in stays theirs
- Only role that approves time-away requests — remote work, vacation, religious holidays and sick days all land in one queue on the Absence requests page, its own item in the sidebar. Approving records those days for the intern (they don't check in), rejecting refuses the whole request, and an approval can be revoked later if it was a mistake. Remote days still count as attendance; the other three take the day out of the percentage altogether, so approving leave never hurts an intern's number and never flatters it either. The Absence requests sidebar item shows a pulsing dot while anything is waiting — worth watching, since a sick day is always for today or the last couple of days and goes stale fast
- Everything already decided moves to the History tab on that page — approved, rejected, withdrawn or revoked, with who decided it and when
- Only role that sets the limits on time-away requests — on the Request limits tab of the same page: how many days one request of each kind may cover, and how many days a year vacation and religious holidays allow. Remote work and sick days deliberately have no yearly limit and can't be given one. Lowering a limit binds what's asked for next; requests already decided keep what they were granted
- Only role that can view the per-workspace Daily standup reporting dashboard (who reported today, calendar-month coverage grid, open blockers) — a read-only compliance view, not a data-entry surface
- Only role that can edit the internal CV link on an intern profile (a mentor can still view it, just not edit it)
- Can open the intern's own uploaded CV from their profile Overview, and generate an AI summary of it. The summary describes what the CV says — education, past roles, technologies, projects, languages — and is deliberately never an assessment: it doesn't score, rank, or say whether someone is a good fit. Readiness, evaluations and mentor notes are the assessments, and those are written by people. It's generated on request, cached, and flagged as out of date if the intern uploads a new CV. The intern never sees it
- Only role that can change an intern's lifecycle status (active/ready/placed/completed/discontinued) — even for an intern with an assigned mentor
- Sets the start date on a placement — the day the intern actually begins on the project, which is often not the day the placement was decided. It is optional: leave it empty when nobody knows yet, and set it later once they do. From that day the intern no longer has to record attendance: those days show in their own colour instead of absent, and the month reads "—" instead of 0%. Until a start date is set the intern keeps recording attendance as normal, and moving the date moves the cut-off with it
- Only role that can leave a note on a staffing request — one short remark, written when they close
  it, for anything leadership should know that the suggested candidates don't say. It cannot be
  edited or added afterwards: a closed request is a fixed record, so what was said at the time is
  what stays
- Only role that can close a staffing request as **fulfilled** (the seats are filled) or
  **declined** (the ask is being refused). Declining requires a reason, which becomes the note
  leadership reads; fulfilling doesn't — the placements say it. Cannot cancel — that is
  leadership's, since only they speak to the outside party. Nothing closes a request automatically —
  even when every seat is placed, an admin still closes it
- Only role that can put interns forward against a staffing request — candidates are picked one
  seat at a time, so each intern is offered for the discipline that was actually asked for. Picks
  are **staged first and sent together**: nothing reaches leadership until "Submit to leadership",
  so a misclick is undone by removing the pick, and one submit is one answer however many seats it
  covered. Staged picks survive a refresh or a look at another request, but they live only in that
  browser — a colleague can't see them, and neither can leadership. Each sent pick creates an
  ordinary recommendation on that project, so the usual interview and placement steps follow.
  Putting someone forward never means they are placed. More interns than the seats asked for can be
  put forward, on purpose. Interns who left the programme or completed it aren't offered; interns
  already placed or already in selection elsewhere are, flagged with where. The same intern can't
  be staged onto two seats of one request. A request still waiting on its project can have
  candidates staged but nothing submitted until the project is resolved
- Cannot edit, cancel or reopen a staffing request. Editing belongs to the leadership user who
  filed it — an admin answers a request rather than restating it — cancelling is leadership's, and
  no closed request can be reopened by anyone
- Closing a request, for any of the three reasons, **closes out everyone still in selection for it**:
  each is recorded as not placed, with one shared reason the admin types in the close dialog, which
  is read by admins, leadership and mentors and never by the intern. Anyone already placed keeps
  their placement, untouched. The interns closed out go back on the ready bench. This can't be
  undone, and there is no per-intern opt-out — if the ask has only shrunk, lower the seat count
  instead, which closes out nobody. For something specific to one person, write it on their own
  recommendation instead of in the shared reason
- Only role that can resolve a staffing request filed against a project that doesn't exist yet
  ("Needs project") — link it to an existing project, or create one from leadership's description.
  Leadership can describe a project when filing but can never create or link one itself. A request
  needing a project can never be closed as fulfilled until it's resolved
- Manages documentation links on intern profiles
- Works with tickets like everyone else, plus can cross workspace boundaries (view tickets/analytics of any workspace, not just their own)
- Manages the GitHub integration of any workspace (connect/disconnect the repo)
- Can edit workspaces (add a workspace image, add backlog statuses, add categories like bug/feature/etc.)

**Leadership**
- Otherwise read-only; the one exception is staffing requests (below)
- Only role that can file a staffing request (recorded demand for interns on a project); can edit a
  request they filed themselves — not a colleague's. Sees every staffing request from every author,
  same as admin. Nobody else can edit it, admins included
- Editing an open request can reach the people already on it. Changing or removing a position the
  request no longer wants **closes out everyone still in selection for that position** — same
  shared reason as closing, asked for before the edit is saved, and warned about by name and count
  first. The one edit that is refused outright: a position someone is already **placed** against
  can't be changed or removed. Lowering a seat count closes out nobody, so "1 wanted, 2 placed" is
  a legal, truthful state. Pointing a request at a different project moves everyone put forward
  with it, placed interns included, and is never refused — repointing only ever means the wrong
  project was named. Every one of these edits shows up in the request's history and tells the other
  side about it
- Only role that can **cancel** a staffing request, and any leadership user can cancel any of them,
  not only their own: only leadership speaks to the outside party, so only leadership can say the
  demand is gone. Cancelling closes out everyone still in selection for the request (see Admin), so
  it asks for a reason for them as well as for the request. It cannot be undone — no closed request
  can be reopened
- Can file a request for a project that doesn't exist on the platform yet, by describing it (name,
  client, description) instead of picking one. It shows as "Needs project" until an admin resolves
  it; leadership never creates the project itself. The details they described stay editable
  afterwards, resolved or not — the history keeps both versions
- Cannot close a request as fulfilled or declined — those are the admin's call. Cancelling is the
  only close available to leadership
- Reads the admin's note on a request (see Admin) but cannot write or edit one, not even on their
  own request. **Must** give a reason when cancelling a request — it can't be added or changed later
- Sees all interns and all their profiles (not just assigned ones, unlike a mentor)
- Sees all recommendations (created exclusively by admin), but can't create/edit them
- Sees programme-wide statistics, the funnel/"In Selection" dashboard
- Sees a read-only "Projects" view (`/projects`): every client project with who's placed on it,
  who's currently in selection (recommended/interviewing), technology demand across projects, and
  each project's full outcome history — no recommend/edit actions, aside from the interns-request
  above
- Each project shows its type (client or internal) next to its status, on both the list and the project page
- The Projects list opens on "With interns" (projects with someone placed or in selection);
  switching to "All projects" shows the empty ones too
- No access to the workspace/ticket side of the platform (project work)
- No access to admin panels (users, workspaces, reference data)

**Mentor**
- Sees only their assigned interns (primary or secondary mentor) — and only Overview, mentor notes, and documentation links
- Adds mentor notes (free text, picks who can see it) only for their own interns
- Can't see or add evaluations (periodic progress assessment) — admin-only now
- Can't see or set readiness (by technology or position) — admin-only now
- Can't see or create recommendations, neither per-intern nor on the standalone "Recommendations" page — admin-only now
- Can't see or manage the Specialization tab, but does get assigned-mentor access to an intern once paired as their specialization mentor
- Can't see the attendance roster (intern attendance overview) — an intern's own check-in is untouched. Mentors have no attendance view of any kind, so remote-work requests go to an admin, not to them
- Can see the CV link on an intern's profile, but can't edit it — admin-only now
- Can open their own intern's uploaded CV and its AI summary, same as an admin (see the admin entry for what that summary is and isn't)
- Can't change an intern's lifecycle status (active/ready/placed/completed/discontinued), even for their own assigned intern — admin-only now
- Can manage documentation links on an intern profile
- Can't create workspaces
- No access to programme-wide statistics
- Also works on tickets/projects within the workspace they belong to, independent of the mentor role — creates tickets, comments, tracks time, exports to CSV, uses AI assistance (summaries, description suggestions), and sees their workspace's analytics

**Intern**
- Sees and edits only their own profile
- Declares their own technologies
- Uploads their own CV
- Has a read-only "My Progress" page with everything the programme records about them: where they stand in the programme (status, dates, mentors, hub), every evaluation, their readiness, and every recommendation. Read-only throughout — nothing there is theirs to add, change, or delete
- Sees their own readiness, both by position and per declared technology, including which ones nobody has assessed yet and who did the assessing. Still can't set a level — that stays admin-only
- Sees their own evaluations in full: the four scores per review period, the movement since the previous period, **and their mentor's written notes** (new — the notes used to be hidden from them)
- Still doesn't see mentor notes (the separate free-text notes a mentor writes with their own "who can see this" list) — those remain invisible to interns
- Sees their own recommendations: which project and position, the technologies, which stage it reached and every date along the way, the interviews, and the final result — but not the recommendation write-up, interviewer feedback, or the reasoning behind the decision. Put forward for more than one project? All of them are listed on My Progress, and arrows on the dashboard card switch between them
- When the opportunity itself ends — the staffing request behind it was closed, or the position they
  were put forward for changed — both the dashboard card and My Progress say the opportunity closed
  before a decision was made about them, rather than "not placed this time". They never see the
  reason the admin typed for it
- Sees no one else's recommendations, evaluations, or readiness
- Can declare an optional secondary position alongside their main one; once an admin assigns a specialization, their confirmed position locks (read-only, badged) and their secondary stays editable
- Works on tickets/projects within their workspace — creates tickets, comments, tracks time, uses AI assistance, sees their workspace's analytics
- Can ask for time away from the Attendance page — four kinds, all decided by an admin as a whole request, all withdrawable while still pending:
  - **Remote work** — up to 3 days per request, no yearly limit. Need more than 3 — an exam week, say — send another request; there's no cap on how many. An approved day **counts as attendance** without checking in
  - **Vacation** — up to 5 days per request and **5 days a year**. Once the year's 5 are used the option locks until January
  - **Religious holiday** — up to 3 days per request and **3 days a year**. The calendar shows when Bajram, Uskrs, Vaskrs, Rosh Hashanah and the rest fall, so they can plan ahead. Islamic dates are marked "to be confirmed" — they're announced rather than calculated, and can move by a day
  - **Sick day** — **one day per request**, no yearly limit, and the only one that can be backdated: today or either of the last two working days, because you file a sick day after being ill, not before. Ill longer? Send another request
- Those four numbers are the starting values, not fixed rules — an admin can raise or lower how many days one request may cover, and the yearly vacation and religious allowances, from their profile. Remote work and sick days have no yearly limit and won't be given one
- Vacation, religious holidays and sick days are **not counted against attendance** — the day leaves the sum entirely, so a week off reads as nothing owed and nothing missed rather than as a week of absences. Remote work is different: it's still work, so it counts as an attended day. Each kind shows in its own colour with its own mark on the calendar
- Records their own daily office check-in — but from the day they start on a real project this stops: check-in is switched off, those days show in their own colour rather than absent, and the month reads "—" instead of 0%. Their earlier attendance is unaffected. Being told they are placed does not stop it — the start date does, so an intern placed today who starts in two weeks keeps checking in until then
- No access to other interns', mentors', or admin/leadership data or functions
- **Interesting:** can't edit their own documentation links either — only Admin, Leadership, and the assigned mentor can; not even the profile owner (the intern)

> **Note:** changing your own password now asks for your current one first, on every role. It's a
> separate action on the Profile page rather than a field on the edit form. Changing it signs out
> every other device you're signed in on — which is the point: if someone else has your session,
> changing your password is how you get rid of them. An admin can still reset someone else's
> password for them; that's the path for a locked-out account, where there's no old password to give.

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
