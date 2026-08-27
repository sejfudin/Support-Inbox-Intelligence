# Sprints — work breakdown

**Internal document · team of 4 · v3 · 10 tasks by feature**

Companion to the mockup in this folder — see [README.md](README.md). This is a **delivery
proposal**, not an agreed plan.

Markdown is the working copy of this document; `Sprints - task breakdown.pdf` in this folder is
the same content as the formatted original — the PDF still says "Person A–D", this file names
people.

## Who's who

| | Person | Track | Tasks |
| --- | --- | --- | --- |
| A | **Benjo** | Sprint settings and lifecycle | T-01 · S-01 · S-02 · part of X-01 |
| B | **Hamza** | Backlog and tickets | K-01 · K-02 · part of X-01 |
| C | **Nedim** | Taskboard and tickets integration | P-01 · P-02 · part of X-01 |
| D | **Dino** | Capacity and report | R-01 · R-02 · part of X-01 |
| — | **Vildan** | QA | X-01 — see the note under Ownership |

## Delivery plan

The split is by feature, not by layer: one person owns one feature from database to screen,
including its tests. After a shared foundation, all four tracks run in parallel and barely touch
each other.

| | |
| --- | --- |
| **10** | tasks, one feature each |
| **58.5** | dev-days total |
| **3.5** | days of foundation, then fully parallel |
| **1** | task depends on someone else — the final integration pass |

## Ownership

Everyone is full-stack: the feature owner writes the database, the API, the screen and the tests
for it. QA and design are roles inside the team — nothing is handed over at the end. The API
contract and mock responses are produced in T-01, so nobody waits on someone else's backend.

| Person | Scope | Tasks | Days |
| --- | --- | --- | --- |
| **Benjo** (Person A) — sprint settings and lifecycle | Foundation, creating and editing sprints, completion, iterations. | T-01 · S-01 · S-02 · part of X-01 | 14.5 |
| **Hamza** (Person B) — backlog and tickets | Backlog, filters, sprint planning, ticket modal. | K-01 · K-02 · part of X-01 | 14 |
| **Nedim** (Person C) — taskboard and tickets integration | Statuses, columns, drag & drop, tickets integration, roles. | P-01 · P-02 · part of X-01 | 14.5 |
| **Dino** (Person D) — capacity and report | Team capacity, snapshots, sprint analytics, export. | R-01 · R-02 · part of X-01 | 15.5 |

> **Open question — where Vildan fits.** This breakdown was written for four people with QA as a
> role *inside* the team ("nothing is handed over at the end", and each owner writes their own
> tests). With Vildan as a dedicated QA that assumption no longer holds, and two things need a
> decision before T-01 starts:
>
> - **Does the owner still write the feature's tests?** If yes, Vildan's work is the cross-track
>   pass — X-01, plus reviewing each track's acceptance criteria as it lands. If no, the estimates
>   below drop for the four owners and X-01 grows.
> - **X-01 is currently "split four ways, one part each."** With a dedicated QA, the E2E scenario,
>   the browser/screen-reader audit and the performance measurement are naturally Vildan's, leaving
>   the four owners the keyboard/focus and visual-polish parts of their own screens.
>
> Neither option changes the 58.5-day total materially — it changes who carries it. Nothing below
> has been re-estimated for five people.

## Tasks

Estimates are ideal dev-days for one person, including tests and review. Titles and descriptions
are ready to paste into a ticket — **Done when** is the acceptance criteria list.

> Every task carries a **Mockup:** reference to a screen or state in the interactive mockup
> **Sprints — labelled nav** (`Sprints - labelled nav.dc.html` in this folder). **The mockup is
> the source of truth** for layout, columns, tones and behaviour — not the description in this
> document.

---

### T-01 · Foundation: data model, API contract and screen shell

**Benjo · 3.5 d · BE + FE · Depends on: —**

Sets up everything the other nine tasks build on. The sprint data model and its companions
(`Sprint`, `SprintTicket`, `Iteration`, `CapacityEntry`) with migrations and seed data, a typed
API contract covering all four tracks with mock responses alongside it, and the frontend shell:
Boards group in the sidebar, sprint tabs, per-sprint deep links and the shared empty, loading and
error states. The goal is that after 3.5 days nobody waits on anyone else's backend — everyone
works against the contract and the mocks.

**Done when**

- Migrations are reversible and run on a clean database with seed data.
- The API contract covers every endpoint the other tasks need, with mock responses the frontend
  can switch on and off.
- `/sprints` opens with tabs and per-sprint deep links, including empty, loading and error states.
- Ownership of `SprintTicket` fields is written down: statuses are changed by P-01, sprint
  assignment by K-01.

**Mockup:** Sidebar → Boards, tabs Backlog / Taskboard / Capacity / Report

---

### S-01 · Sprint settings: create, edit and activate a sprint

**Benjo · 5 d · BE + FE · Depends on: T-01**

The full sprint lifecycle up to completion. Backend: sprint CRUD with validation of name, dates
and capacity, overlap checks against other sprints, and the rule that at most one sprint per
project is active. Frontend: the new sprint dialog with inline validation and a submitting state,
editing an active sprint with locked fields that must no longer change, and a sprint header
showing dates and days remaining.

**Done when**

- A new sprint is created from the dialog; overlapping dates and missing required fields produce
  inline errors, not a toast.
- Activation is idempotent and never allows a second active sprint in the same project.
- Editing an active sprint changes dates and capacity; locked fields are visibly disabled with an
  explanation.
- Tests cover date validation, overlap and double activation.

**Mockup:** New sprint dialog + sprint header

---

### S-02 · Sprint completion and iteration history

**Benjo · 5 d · BE + FE · Depends on: S-01**

Closing a sprint without losing work: unfinished tickets are carried into the next sprint or
returned to the backlog, the sprint is locked against edits, and the event is written to the audit
log. The UI side is a confirmation dialog summarising what will be carried over, plus a toast with
the number of moved tickets. On top of that the iterations screen: history of every sprint with
its key numbers, reopening a closed sprint, and comparing two sprints.

**Done when**

- Completion is transactional: either everything is carried over and the sprint locks, or nothing
  happens.
- Before confirming, the dialog shows the exact number of unfinished tickets and the destination
  choice (next sprint or backlog).
- A closed sprint cannot be edited; reopening is audited with user and timestamp.
- The Iterations list shows every closed sprint with duration, completed and carried over.

**Mockup:** Complete sprint dialog + toast, Iterations

---

### K-01 · Backlog: browsing, filtering and sprint planning

**Hamza · 7 d · BE + FE · Depends on: T-01**

The main planning screen. Backend: a backlog endpoint with sections, sorting, filters and
pagination, story point sums per section, and transactional bulk assign/unassign to a sprint.
Frontend: the backlog table with its columns, badge tones, priority and story points, multi-row
selection, per-section collapse and Collapse all, sums in the section header, and drag & drop of
tickets into the sprint with optimistic updates and rollback on failure.

**Done when**

- Filters, sorting and pagination work together and survive a reload (state in the URL).
- Multi-row selection plus one action adds or removes tickets from the sprint in a single
  transaction.
- Drag & drop moves a ticket between sections and into the sprint; a failure returns the card to
  its original position with a message.
- Story point sums per section and for the sprint update without reloading the whole list.
- A list of ~500 rows stays usable (virtualisation or pagination, measured).

**Mockup:** Sprints → Backlog (table, sections, Collapse all, drag into sprint)

---

### K-02 · Creating and editing a ticket from the sprint and the backlog

**Hamza · 5.5 d · BE + FE · Depends on: K-01**

The new ticket modal, reachable from both places — the backlog and the taskboard — prefilling
sprint and section from the context it was opened in. Fields: title, description, type, priority,
story points, assignee, labels. Inline validation, a submitting state, and editing an existing
ticket through the same modal. The backend part is a create/update endpoint with permissions and
a change record.

**Done when**

- Opened from a sprint the modal prefills sprint and section; opened from the backlog it leaves
  the sprint empty.
- Field errors are inline; the modal does not close on a failed submit and does not lose entered
  data.
- Editing reuses the same modal and shows current values without flicker.
- A new ticket appears in the list without a full reload, in the correct position for the active
  sort.

**Mockup:** New task modal (from Backlog and from Taskboard)

---

### P-01 · Taskboard: columns, cards and status changes

**Nedim · 8 d · BE + FE · Depends on: T-01**

The screen for running a sprint day to day. Backend: a status model with allowed transitions,
record versioning and concurrent-edit resolution, plus per-project column and WIP limit
configuration. Frontend: columns with counters — the first one being **Previous sprint** holding
carried-over tickets — the ticket card with avatar, priority and story points, drag & drop between
columns with optimistic updates and rollback, WIP warnings, and filters by assignee, priority and
labels.

**Done when**

- Previous sprint is the first column and clearly marks carried-over tickets.
- Allowed transitions are enforced on the backend; a disallowed move returns a clear error.
- When two people move the same ticket, the second gets a conflict message and fresh state — no
  silent overwrite.
- Exceeding the WIP limit warns rather than blocks, and is visible on the column.
- Filters have empty states and a reset; the filter combination lives in the URL.

**Mockup:** Sprints → Taskboard (Previous sprint as first column, cards, drag & drop, filters)

---

### P-02 · Sprint on tickets, roles and permissions

**Nedim · 5 d · BE + FE · Depends on: T-01**

Sprints have to exist outside the Sprints screens: a sprint field, column and filter on the
existing tickets screen (both list and board view), without changing the existing ticket model.
Alongside it the permission layer: role definitions, endpoint gating on the backend and the
corresponding hiding or disabling of actions in the UI, with explanatory messages instead of an
empty screen when the user lacks rights.

**Done when**

- The sprint column and filter work in both the list and board views, with no regression to
  existing filters.
- Every sprint endpoint checks the role; bypassing the UI does not get through.
- An intern sees neither Capacity nor sprint completion actions; disabled actions carry an
  explanation.
- The role × screen × action matrix is covered by tests.

**Mockup:** Tickets → Sprint column and filter; Role switch → intern

---

### R-01 · Team capacity within a sprint

**Dino · 4.5 d · BE + FE · Depends on: T-01**

Making load visible per team member. The backend aggregates available days, absences and assigned
story points in done and in progress, and derives the overload flag. The frontend shows the member
list with a done / in-progress bar against available capacity, team totals, and an empty state for
a sprint with nothing assigned yet.

**Done when**

- An overloaded member is visually flagged by a rule written down in the ticket, not by feel.
- Team totals match the sum of taskboard cards for the same sprint.
- Empty state and the no-capacity-defined state are both implemented.
- The screen is hidden for roles without rights (wired to P-02).

**Mockup:** Capacity (workload per member)

---

### R-02 · Sprint report and analytics with export

**Dino · 9.5 d · BE + FE · Depends on: T-01**

Measuring the sprint. A daily snapshot of sprint state is written from day one, because a burndown
without history does not exist. Aggregations build on it: velocity, carry-over, health, and
distribution by member and type. The frontend has two tabs — Summary with the sprint recap, key
numbers and the carried-over list, and Stats with burndown, velocity trend and distribution. Plus
CSV and PDF export carrying the same data as the screen, with downloading and error states.

**Done when**

- The snapshot is written automatically every day and for the sprint completion day.
- Report numbers match the taskboard and capacity after the sprint is closed.
- Charts have an empty state for a sprint without history and do not block the rest of the screen
  from rendering.
- Export returns the same data set as the screen; a download failure is surfaced to the user.

**Mockup:** Report → Summary, Report → Stats, Report → Export menu

---

### X-01 · Integration pass: end-to-end flow, accessibility and polish

**Benjo · Hamza · Nedim · Dino, split — plus Vildan on QA · 5.5 d · QA + design + FE · Depends on:
S-02, K-02, P-02, R-02**

The final task, where the four tracks come together as one flow. An integration E2E walks a single
sprint from creation, through planning and the board, to capacity and the report. Alongside it: a
keyboard alternative to drag & drop and a sane focus order, verification on Chrome, Safari and
Firefox with a screen reader, a visual pass across every screen with microcopy and term tooltips
(velocity, carry-over), and performance measurement at realistic volume. Split into four parts,
one per person.

**Done when**

- One E2E scenario passes the whole flow across all four tracks in CI.
- Every drag & drop action has a keyboard alternative and announces the change to a screen reader.
- A per-browser audit report is recorded, with findings either closed or explicitly accepted.
- Alignment, tones and copy match the mockup; terms are explained in the UI.

**Mockup:** all screens (plan → board → capacity → report)

---

## Load and sequence

| Person | Task sequence | Demo when finished | Days |
| --- | --- | --- | --- |
| Benjo | T-01 → S-01 → S-02 → X-01 | A sprint from creation to completion, history in Iterations | 14.5 |
| Hamza | K-01 → K-02 → X-01 | Filtered backlog, drag into sprint, new ticket from context | 14 |
| Nedim | P-01 → P-02 → X-01 | Ticket through the columns without conflict, sprint visible on tickets | 14.5 |
| Dino | R-01 → R-02 → X-01 | Overloaded member flagged, report with velocity and burndown | 15.5 |

## Definition of done

- The feature owner writes its tests too — nothing is handed to QA at the end.
- Code reviewed by one other person on the team.
- Empty, loading and error states implemented — not just the happy path.
- Keyboard and focus work; drag & drop has an alternative.
- Screen checked side by side against the mockup before merging.
- No temporary data and no feature flags left switched off.

## Risks

**The foundation is the only bottleneck.** T-01 blocks all four people. It goes first, paired if
needed, and its scope does not grow mid-flight.

**The backlog / taskboard boundary.** Both touch `SprintTicket`. Status belongs to P-01, sprint
assignment to K-01 — agreed in T-01, no overlap.

**Burndown depends on history.** R-02 must write the daily snapshot from day one, otherwise the
first sprint has no chart.

**Drag & drop is the most expensive part.** It sits in K-01 and P-01 with two different people. If
it overruns, ship status changes from a menu first.

## Assumptions

The team is four people in total — QA and design are roles inside the team, not extra headcount.
(**Superseded:** Vildan is a dedicated QA, so the team is five. See the open question under
Ownership — the split below has not been re-estimated for that.)
Tasks are deliberately coarse: with AI support the owner breaks them into subtasks in the ticket.
Azure DevOps sync is out of scope. The existing tickets model is extended, not replaced. Estimates
exclude devops, staging environments and historical data migration.

## Where this plan meets the current codebase

Three things in the breakdown assume a stack this repo doesn't have. They need a decision before
T-01 starts — the estimates are otherwise unaffected:

- **"Migrations are reversible"** — persistence is MongoDB via Mongoose (`server/models/`, 29
  schemas) with no migration tooling in the repo. The equivalent here is a schema addition plus an
  idempotent backfill script under `server/seeder/`.
- **"A typed API contract"** — both packages are plain JavaScript, no TypeScript. Read this as the
  contract being written down and mocked, not type-checked.
- **"One E2E scenario passes ... in CI"** (X-01) — there is currently no integration or E2E suite;
  tests are colocated `*.test.js` files over pure functions. X-01 therefore includes standing an
  E2E harness up, which its 5.5 days may not cover.

Two more that are open questions rather than mismatches:

- **"per project"** (S-01, P-01) — this platform scopes to **workspaces**, and every ticket
  operation must be workspace-scoped (see `.claude/docs/security.md`). Read "project" as
  "workspace" throughout, and hold sprints to the same scoping rule.
- **"role definitions"** (P-02) — the platform roles already exist (admin, mentor, leadership,
  intern). P-02 should map sprint actions onto those rather than introduce a parallel role set, and
  update the Roles & Permissions section of `docs/TEAM_HANDBOOK.md` in the same change.
