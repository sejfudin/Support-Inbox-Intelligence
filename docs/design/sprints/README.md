# Sprints — design mockup and work breakdown

A design proposal for a sprint module on top of the existing ticketing feature, plus a proposed
split of the work across four people.

**This is a proposal for review, not a spec and not a commitment.** Nothing here has been agreed
with the team, and every number, name and ticket in the mockup is invented.

Author: Hamza Tuco (product design). Built 25–27 Aug 2026 against `frontend/src`.

---

## Start here

1. **Open the mockup.** Double-click `Sprints - labelled nav.dc.html`, or from the repo root:

   ```
   open "docs/design/sprints/Sprints - labelled nav.dc.html"
   ```

   No server, no build, no `npm install`. Click the sidebar items and the tab strips to move
   between screens. It opens on the sprint backlog.

2. **Read [TASKS.md](TASKS.md)** — 10 tasks, one feature each, with acceptance criteria and
   estimates. Each task points at the screen in the mockup it belongs to.

3. **Bring your objections.** The sections *Design decisions worth arguing about* and *Known gaps*
   below are the parts most likely to be wrong.

The mockup needs a network connection only for Google Fonts (Poppins / Montserrat). Without one it
falls back to system fonts and the layout still reads correctly.

## What's in this folder

| File | What it is |
| --- | --- |
| `Sprints - labelled nav.dc.html` | **The mockup.** All screens, all state, one self-contained file. |
| [TASKS.md](TASKS.md) | **The work breakdown.** 10 tasks, ownership, sequence, risks. Working copy — read this one. |
| `Sprints - task breakdown.pdf` | The same breakdown as the formatted original, for sharing outside the repo. |
| `README.md` | This file. |
| `support.js` | Generated canvas runtime the mockup loads. Don't edit. |
| `frontend/public/brand/TMLogo.png` | Copy of the real brand logo, at the subpath the mockup expects. Duplicated on purpose so the folder opens standalone and a re-export drops in with no path edits. |

The mockup keeps its spaces and its `.dc.html` extension so it still matches the design canvas it
came out of — re-exports overwrite it cleanly.

## If you're picking up a task

The mockup is the source of truth for layout, columns, tones and behaviour — not the prose in
`TASKS.md`. Open the mockup next to your editor and work against the screen. Which screen belongs
to which task:

| Task | Owner | Screen to open in the mockup |
| --- | --- | --- |
| T-01 Foundation | **Benjo** | Sidebar → Boards; the Backlog / Taskboard / Capacity / Report tab strip |
| S-01 Sprint create & activate | **Benjo** | New sprint dialog; the sprint header band |
| S-02 Completion & iterations | **Benjo** | Complete sprint dialog + toast; Iterations |
| K-01 Backlog & planning | **Hamza** | Sprints → Backlog (table, sections, Collapse all, drag into sprint) |
| K-02 Ticket create & edit | **Hamza** | New task modal, opened from Backlog and from Taskboard |
| P-01 Taskboard | **Nedim** | Sprints → Taskboard (Previous sprint as first column, cards, filters) |
| P-02 Sprint on tickets, roles | **Nedim** | Tickets → Sprint column and filter; View as → Intern |
| R-01 Capacity | **Dino** | Capacity (workload per member) |
| R-02 Report & analytics | **Dino** | Sprint report → Summary; Sprint report → Analytics |
| X-01 Integration pass | all four + **Vildan** (QA) | Every screen, in order: backlog → taskboard → capacity → report |

Where each person should start:

- **Benjo** — open the mockup, then the sprint header band at the top of the Backlog and the New
  sprint dialog. Your three tasks are the sprint's whole lifecycle, and T-01 unblocks everyone
  else, so it goes first.
- **Hamza** — the screen the mockup opens on *is* your task. Look at the section grouping, the
  `Carried ×N` badges, the per-section point sums and Collapse all.
- **Nedim** — Taskboard tab. Note that the first column is **Previous sprint**, not a status; then
  switch to Tickets to see the Sprint column and filter you're adding there.
- **Dino** — Capacity, then Sprint report → Analytics. The burndown's scope-change marker and the
  velocity strip are the two pieces with no equivalent in the app today.
- **Vildan** — walk the whole flow in order (backlog → taskboard → capacity → report); that path
  is the E2E scenario X-01 asks for. `TASKS.md` carries an open question about how your work
  splits from the owners' own tests — worth settling before T-01.

Two conventions to keep in mind while you build, both from the repo's own rules:

- **Everything is workspace-scoped.** `TASKS.md` says "per project" in places; on this platform
  that means **per workspace**, and no sprint read or write may cross workspaces. See
  `.claude/docs/security.md`.
- **Branch off `development`, and open the PR against `development`.** `master` is the release
  branch.

`TASKS.md` ends with a section on where the plan meets the current codebase — read it before
starting T-01, it names three assumptions the stack doesn't hold.

## What the mockup covers

Screens, in the order the nav presents them:

**App shell.** The sidebar is the "labelled nav" variant — sections carry visible headings
(Workspace / Boards / Admin) instead of relying on grouping alone. The sprint feature adds five
items under **Boards**: Sprints (badged `NEW`), Capacity, Sprint report, Sprint settings, Archive.

**Tickets** — the existing list and board, with two additions: a `Sprint` column in the table and
a sprint filter/picker above it. The board view gains a "Loaded from *sprint*" line.

**Sprints → Backlog** (default screen) — sprint header band with goal, dates, day counter, task
count and points progress; grouped sections with per-section counts and points; per-row story
points, priority, state, assignee, and a `Carried ×N` badge on work pulled from earlier sprints.
An `Unscheduled` section holds work not yet committed. Actions: Add task, Complete sprint.

**Sprints → Taskboard** — status columns with task count and points per column, cards showing ID,
points, priority, assignee and carry-over, plus a drop target for empty columns.

**Capacity** — "Who is working on what": per-member tasks done, points done, points in progress,
and a split view. Marked **Admin only** in the mock.

**Sprint report** — two tabs.
*Summary*: an AI-drafted sprint write-up (whole team or per intern, regenerable), with an explicit
"AI drafting is off for this workspace" state.
*Analytics*: burndown (ideal vs remaining, with a **scope-change marker**), velocity over the last
five sprints, points by status, points by work type, average time in status, carry-over count, and
a sprint-health strip.

**Iterations** — two-week cadence, table of sprints with dates, state, committed and completed
points; New sprint dialog.

**Sprint settings** — start day, sprint duration, name pattern (`Sprint {n}`), what happens when a
sprint completes, and workspace-wide rules.

**Dialogs** — create a sprint, sprint history, add item, new ticket.

## Design decisions worth arguing about

These are deliberate, and they are the parts most likely to need a conversation:

- **Capacity is measured in story points, not hours.** No hour budgets, no per-person daily
  capacity. Simpler, but it means the tool can't tell you someone is over-booked.
- **Sprints are never defined ahead of time.** The next sprint is created when the current one
  completes — there is no backlog of future sprints to plan into.
- **Carry-over is counted and shown on the ticket** (`Carried ×2`). Azure Boards doesn't surface
  this; here it's meant to make chronic carry-over visible during planning.
- **The burndown marks scope changes** rather than silently re-baselining.
- **The sprint summary is AI-drafted**, with a per-workspace off switch.
- **Running a sprint is a privileged action.** Non-admins see the backlog read-only ("a sprint
  admin runs sprints here") and Capacity is admin-only. Which platform roles map to "sprint admin"
  is **an open question for the team** — if we go ahead, it needs deciding alongside
  `.claude/docs/security.md` and the Roles & Permissions section of `docs/TEAM_HANDBOOK.md`.

## Known gaps

Measured against Azure DevOps Boards' Sprints hub, the planning machinery is the weak part:

- No backlog filters or multi-select — you can't bulk-move work into a sprint. (K-01 adds these.)
- No "taskboard grouped by person" view.
- No forecasting.
- Next-sprint creation is manual.

## What the mockup was drawn from

It recreates the real app shell and table styling from source, so it should feel like the current
product rather than a generic wireframe:

| Mockup area | Source |
| --- | --- |
| App shell / sidebar | `frontend/src/components/AppSidebar.jsx`, `frontend/src/layouts/SidebarLayout.jsx`, `frontend/src/components/WorkspaceSwitcher.jsx`, `frontend/src/components/TaskManagerBrand.jsx` |
| Design tokens (color, radii, heights, type) | `frontend/src/index.css`, `frontend/src/styles/themes.css`, `frontend/tailwind.config.js` |
| Page header + control bands | `frontend/src/components/PageHeading.jsx`, `frontend/src/components/PageShell.jsx`, `frontend/src/components/Tickets/TicketsHeader.jsx`, `frontend/src/components/Tickets/TicketsTabs.jsx` |
| Tickets list (+ Sprint column) | `frontend/src/pages/TicketPage.jsx`, `frontend/src/components/Tickets/TicketsTable.jsx`, `frontend/src/components/columns/ticketColumns.jsx`, `frontend/src/components/StatusBadge.jsx`, `frontend/src/components/PriorityIndicator.jsx`, `frontend/src/components/StoryPointsIndicator.jsx` |
| Sprint backlog grid | `frontend/src/pages/Backlog.jsx`, `frontend/src/helpers/badgeTones.js`, `frontend/src/helpers/ticketPriority.js` |
| Taskboard | `frontend/src/components/BoardPage.jsx` |
| Capacity, burndown, iterations, dialogs | `frontend/src/components/ui/button.jsx`, `frontend/src/components/ui/badge.jsx`, `frontend/src/index.css` (`.app-card`, `.app-table-*`) |

## Caveats

- **Static state.** Every number, ticket and chart is hardcoded in the mockup. There is no data
  layer, no API shape implied, and no schema proposed here — that's T-01's job.
- **Desktop only.** No responsive or mobile behaviour has been designed.
- **Light theme only.** The app has a theme system (`frontend/src/styles/themes.css`); the mockup
  does not exercise it.
- **Not accessibility-reviewed.** Focus order, keyboard paths and contrast still need a pass —
  that's X-01.

Questions, or want a walkthrough — ask Hamza.
