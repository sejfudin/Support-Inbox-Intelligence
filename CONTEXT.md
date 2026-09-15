# Domain Language

The project's ubiquitous language — the canonical term for each domain concept, so
code, issues, and docs all use the same word for the same thing. This is a glossary,
not a spec. A broader reference glossary of platform-wide terms lives in
`.claude/docs/architecture.md`; this file holds terms actively resolved during design.

## Dailies

**Daily**:
A workspace's standup record for a single calendar date — one per workspace per day,
recorded live by a scribe. Starts empty; entries are added as the standup runs.
_Avoid_: standup (the ceremony), meeting, scrum.

**Daily entry**:
One intern's slot within a Daily: lists of what they did (done), what they'll do (todo),
and their blockers — each blocker is text with one optional linked workspace ticket. Added by the scribe
per intern; mentors/admins scribe but don't get an entry. Having an entry means the intern
was present — there is no separate present flag.
_Avoid_: row, update, report.

**Scribe**:
The workspace member who records a Daily (creates it and adds/edits entries). Not a stored
role — any active workspace member can scribe, and it can rotate day to day.
_Avoid_: facilitator, note-taker, owner.

**Presence**:
Implicit attendance: an intern with an entry in a Daily was present; one with no entry is
absent for that date. There is no explicit present/absent field. Distinct from the separate
self-check-in **Attendance** feature (to be reconciled later).
_Avoid_: checked-in (that belongs to the Attendance feature), present/absent flag.

**Edit window**:
The period a Daily stays editable: its date up to one working day in the past. Older
Dailies are frozen read-only history.
_Avoid_: grace period, lock time.

## Projects

**Project type**:
What kind of work a `Project` is, picked by the admin when the project is created and
changeable afterwards. **Provisional set** — a starting pair pending the full list from the
program leads, so expect values to be added and the wording to be revised:
- **Client** — built for an external paying customer.
- **Internal** — built for the firm itself, no external customer.

Purely descriptive: it is a label shown on project views, and no rule, filter or statistic
depends on it. Independent of the **`client`** field, which is free text and may legitimately
name an internal stakeholder team — a project's type is not derived from whether that field is set.
_Avoid_: category, kind, classification.

## Specializations & positions

**Main position**:
The single `Position` an intern self-declares as their focus — the existing
`InternProfile.declaredPosition` field. Required for the intern to be meaningful, but
not enforced at registration.
_Avoid_: primary role, first choice.

**Secondary position**:
An **optional**, nullable second `Position` the intern also declares interest in. Must
differ from the main position when set. No placement logic depends on it — there is no
pool of open positions in scope. Its only consumer: the admin may later confirm it as the
intern's specialization. A day-one "pick both" nudge is a social convention, never a
code-enforced invariant.
_Avoid_: fallback role (there is no fallback-placement path yet), primary/secondary role.

**Specialization**:
The admin confirming **one of the intern's two declared positions** (main or secondary —
hard-constrained, never a free position) as the intern's focus, **paired atomically** with a
dedicated 1-on-1 mentor. Position + mentor are set together in one action — no half-states.
Assigned **only by a platform admin**; mentors receive the pairing but never create it.

Mechanics:
- Marker is a new `InternProfile.specializationAssignedAt` timestamp. **Set ⟹ `declaredPosition`
  IS the specialization.** No separate "which position" field — assignment always lands the
  confirmed position in `declaredPosition`.
- If the admin picks the **secondary** position, main and secondary **swap** so the confirmed
  position becomes `declaredPosition` and the old main drops to secondary. Picking the main is a
  no-op swap.
- While set: `declaredPosition` is **locked to the intern** (read-only, shown with a
  SPECIALIZATION badge, promoted to the top slot). The **secondary stays intern-editable**.
- **Clear**: drop `specializationAssignedAt` + `secondaryMentor`. **No un-swap** — the position
  stays where the swap left it; the intern simply regains edit control. Reassigning to the other
  position swaps again.
- The original pre-swap "which was main" is intentionally **not** retained.
_Avoid_: track, discipline collection (it is just a `Position` value + a mentor).

**Specialization mentor**:
The single mentor an intern is paired with 1-on-1 for their specialization. Stored in the
existing `InternProfile.secondaryMentor` field; must differ from `primaryMentor`. **Written only
by an admin as part of assigning a specialization** — single writer, single meaning. The
invite/registration flow no longer sets this field (its picker is removed). Legacy invite-set
values are meaningless without a `specializationAssignedAt` and should be treated as "no
specialization" (see ADR 0002).
_Avoid_: co-mentor, area mentor, second mentor (it is *the specialization mentor*, nothing else).

> **Naming trap:** In this org's everyday speech, "admin" = the *main mentor* / program leader
> (the platform **admin** role), and "mentor" usually means the *specialization mentor* (the
> `secondaryMentor`). In code and docs use the platform-role words: **admin** assigns, the
> **specialization mentor** is assigned.

## Skills

**Skill**:
The umbrella term for anything an intern declares on Position & Skills and a mentor can
assess — one `Technology` row either way, one `InternProfile.selfTechnologies` array, one
`ReadinessFlag` shape. Use it whenever a sentence covers both halves below ("declared
skills", "readiness by skill").
_Avoid_: competency, capability, tech (as a catch-all).

**Technology**:
The general half of the skill catalog: languages, frameworks, databases, tooling, design and
QA practices — `Technology` with `category: 'general'` (or no category at all, on rows seeded
before the field existed). Still the right word for one specific row of that half; not the
word for the two halves together.
_Avoid_: stack (a stack is several), tech.

**AI skill**:
The AI half of the same catalog — `Technology` with `category: 'ai'`. Coding agents and
assistant IDEs (Claude Code, Cursor, Copilot, Windsurf), the LLM APIs and agent SDKs behind
them, and the practices that come with both (MCP, Agent Skills, prompt engineering, evals).
Distinct from the ML stack, which stays a technology: **PyTorch trains a model, Claude Code
uses one.** Declared, assessed and staffed exactly like a technology — the category decides
only which search box finds it and which section lists it.
_Avoid_: AI tool (the practice entries are not tools), GenAI skill, AI technology (the point
of the term is that it reads as *not* one of the technologies).

## Staffing requests

**Staffing request**:
Leadership's record of demand that arrived from **outside the platform** — a project needing a
stated number of interns placed on it. Authored on the leadership side, acted on by an admin.
Demand only: a staffing request never says who is on a project, only how many are wanted.
_Avoid_: request (bare — invitations and recommendations are also requests), opening, headcount
slot, demand.

**Requested position**:
One discipline's worth of demand inside a staffing request: a `Position`, how many interns are
wanted for it, and optionally the technologies they should know. A position appears at most once
per request — more demand for the same discipline is a higher count, never a second entry. A
request is a set of requested positions; the interns it asks for in total is the sum of their
counts, and each is worked and counted separately.
_Avoid_: line, line item, slot, opening, role (a role is a platform role — admin/mentor/
leadership/intern).

**Putting interns forward**:
The admin's response to a staffing request: choosing interns, which **creates recommendations**
for the request's project. A staffing request holds no intern list of its own — who is being put
forward, and whether they were placed, is always read off those recommendations. It means *put
forward*, never *placed* — placement is the recommendations' own outcome, reached later and per
intern.
_Avoid_: fulfilling (**fulfilled** is a close reason, below — using it for this act too made one
word mean both "interns were offered" and "the ask is done"), assigning, staffing (as a verb for
this act), placing (that is the recommendation's outcome, not this act).

**Closing a request**:
Ending a staffing request. Terminal — a closed request is never reopened, and there is no delete.
Exactly one of three reasons, each owned by one role:
- **Cancelled** — the outside ask evaporated. **Leadership only**: only they speak to the outside
  party, so only they can state that the demand is gone.
- **Declined** — the ask is being refused rather than filled. **Admin only**, reason required. This
  is the answer leadership takes back to whoever asked.
- **Fulfilled** — the ask is done, whether the counts were met or the outside party said "that's
  enough". **Admin only.**

Closing always **closes out** whoever is still in selection, whatever the reason.
_Avoid_: cancelling (as a word for closing generally — it is one specific reason), archiving,
resolving (that is the draft **project** being resolved), reopening (does not exist).

**Closing out**:
An intern's still-live recommendation being resolved as **not placed** because the demand behind it
ended, not because anyone judged them. Happens when the staffing request closes for any reason, or
when the requested position it was created against is changed or removed. A **placed** intern is
never closed out — placement is a fact about them, not about the demand.
_Avoid_: releasing, cancelling (a *request* is cancelled; an *intern* is closed out), withdrawing,
rejecting (nobody rejected them — that is the whole point).

## Recommendations & placement

**Put forward**:
An intern having been offered to a project by an admin — i.e. a recommendation exists for them on
it. Counts **every** intern ever offered against a requested position, including the ones since
closed out, so it is a record of effort spent rather than of who is still live. A request's progress
is therefore always three numbers next to what was wanted: "6 put forward, 0 in selection, 2
placed" means six were offered, none are still live, and two are on the project. No number is
meaningful alone, and **put forward** on its own says nothing about whether anyone is still being
considered.
_Avoid_: proposed, submitted, shortlisted, sourced (all seen in drafts — this is the one term).

**Demand ended**:
The mark on a **not-placed** recommendation saying the not-placement was caused by the ask behind it
ending rather than by a decision about the intern. Set only by **closing out**, never by hand — an
admin resolving someone deliberately is making a decision, which is the opposite of this. The
intern's own view renders it as the opportunity having closed before a decision was made about them,
never as an outcome they earned.
_Avoid_: cancelled, withdrawn, lapsed, auto-resolved.

**In Selection**:
The user-facing name for an intern's `recommended` or `interviewing` recommendation status —
ready and actively being put forward, not yet `resulted`. On a staffing request it is also a
**count**: how many of the interns put forward are still live, as distinct from how many were ever
offered. That distinction is what stops a request whose candidates have all been closed out from
still reading as though it has a full pipeline. Already the term used on the
leadership Projects view (`InSelectionModal`, "Skills in selection"); this made the same term the
canonical one for the leadership Candidates filter and dashboard KPIs, which previously said
"In Pipeline" / "Pipeline" for the identical concept and confused users on both the leadership and
intern side. The intern-facing dashboard card for the same concept is **"My Selection Process"**
(was "My pipeline").
_Avoid_: pipeline, in pipeline (as UI copy — "pipeline" stays only as the internal/doc term for
the whole `recommended → interviewing → resulted` lifecycle, see `.claude/docs/architecture.md`).

## Code review

**Review request**:
An intern asking one of their own mentors to look at the work on a ticket. At most one per
ticket, live or answered, and asking again **replaces** the previous one. Always names one
GitHub pull request, by URL, typed by the intern and **required** — an ask with nothing to look
at is the thing this replaces. The URL is what the intern *claims* the reviewer should look at,
and is never treated as proof that pull request exists or is theirs. Distinct from the ticket's
**linked pull request**, which GitHub reports and nobody types; the two can disagree.
_Avoid_: review (bare — a review is the reviewer's answer, not the ask), approval request,
PR request, code review request (it reviews the work on a ticket, which may be more than a PR).

**Reviewer**:
The single mentor a review request is addressed to — always either the intern's **primary mentor**
(`InternProfile.primaryMentor`, in everyday speech the "main mentor", and often a platform admin)
or their **specialization mentor**, and only when that mentor is an
active member of the ticket's workspace. Never a free choice of person: an intern cannot ask a
teammate, and nobody outside the workspace can be asked, because they could not open the ticket.
_Avoid_: approver (approving is one of two answers), assignee (that is who does the work),
requested reviewer (GitHub's term for its own reviewer list — a different thing).

**Answering a review**:
The reviewer's verdict on a review request: **approved** or **changes requested**. Both are
answers — neither ends the ticket, and neither is a gate on anything. Changes requested is not
a rejection; the intern fixes the work and asks again, which replaces the request and puts it
back to pending. The verdict is kept and shown until that happens.

The verdict carries **no words**. The platform records *that* the reviewer answered; *why* lives
on the pull request, where the reviewer writes it. So a changes-requested answer on its own never
tells the intern what to change — it tells them to go read the review.
_Avoid_: rejecting, blocking, failing the review, sign-off (nothing is signed off — see
`Ticket.blockedBy` for the separate, unrelated notion of a ticket being blocked).

**Cancelling a review request**:
The intern withdrawing their own ask before it is answered. Nothing is owed and nobody is
notified — the item simply leaves the reviewer's list.
_Avoid_: declining (that would be the reviewer refusing, which does not exist), closing,
deleting.

**Going stale**:
A review request being dropped because the work it asked about is over — the ticket reached a
done status, or was archived. Not an answer and not a cancellation: nobody acted, so nobody is
notified.
_Avoid_: expiring (no clock is involved), auto-declining, timing out.

## Sprints

**Sprint**:
A named stretch of calendar time in a **workspace**, holding the tickets the team has committed to
finishing within it. Belongs to a workspace, never to a project — every ticket in the workspace
competes for the same sprint. A sprint holds no list of its own: which tickets are in it is always
read off the tickets. Two sprints in one workspace may never overlap in time, so "the sprint running
today" is never ambiguous.
_Avoid_: iteration, cycle, milestone, epic.

**Sprint goal**:
One optional sentence saying what should be true when the sprint ends. Purely descriptive — no rule,
filter or statistic depends on it.
_Avoid_: objective, theme, commitment.

**Sprint cadence**:
How long a sprint runs when nobody picks dates — **two weeks** unless the workspace says otherwise.
Picking dates is optional: left alone, a new sprint runs one cadence from the day after the
latest-ending sprint ends. It only ever decides a *default*; a sprint dated by hand is unaffected,
and both are held to the same rules (a week to eight weeks, no overlap, no backdating).
*Avoid*: sprint duration (that is one sprint's actual length), velocity, interval.

**Active / upcoming / past sprint**:
A sprint's state, read off today's date against its start and end. **Upcoming** has not started,
**active** is running, **past** has ended. Nobody starts or finishes a sprint by hand, so a sprint
can never disagree with the calendar. Upcoming and active sprints can be edited; a past sprint is
frozen, which is what makes it a record. Only an upcoming sprint can be deleted.
_Avoid_: open/closed, current (ambiguous between active and upcoming), completed, archived (a ticket
is archived; a sprint is past).

**Unsprinted**:
A ticket in no sprint. Every ticket is in at most one sprint, so unsprinted is a plain fact about the
ticket, not a computed set. The tickets available to add to a sprint are exactly the unsprinted ones.
_Avoid_: unassigned (that is about people), free, available.

**Adding a ticket to a sprint**:
Committing a ticket to be finished within that sprint. It is also the sanctioned way for a ticket to
**leave the backlog** — adding promotes it onto the board. The reverse is not true: taking a ticket
out of a sprint leaves it where it is on the board and never returns it to the backlog. A ticket
cannot be added without an estimate.
_Avoid_: assigning (that is about people), scheduling, planning, committing.

**Rollover**:
What happens when a sprint ends and nothing follows it: the finished sprint's numbers are **sealed**,
a successor is created on the cadence, and every ticket that is not done **carries over** into it
keeping the status it was in — in progress stays in progress, to do stays to do. Done tickets and
archived ones stay behind. It happens the next time somebody reads the sprints, not on a clock, so
nothing happens in a workspace nobody opens. A team that has already planned its next sprint gets no
rollover at all — nothing is added to a sprint a person planned.
*Avoid*: closing or completing a sprint (nobody does either), rolling forward, auto-sprint.

**Carrying over**:
Moving an unfinished ticket out of the sprint that did not deliver it and into the next one. Done by
hand from the create modal's leftovers tab, or by the **rollover**. Either way it moves the ticket,
because a ticket is in at most one sprint — which is why the sprint being left is sealed first, so
its record still says it missed the work.
*Avoid*: rescheduling, deferring, re-committing, spillover (that names the tickets, not the act).

**Sprint progress**:
How much of a sprint's committed work is finished, measured in **story points**, never in ticket
count. Tickets split three ways: **done**, **in progress** — anything neither done nor still in the
first board status — and **to do**. Archived tickets keep their sprint but count towards nothing, so
cancelling work never holds a sprint below 100%.
_Avoid_: completion, velocity (velocity compares finished points *across* sprints; progress is
within one).

**Needs attention**:
The tickets in the active sprint that are not moving on their own: those sitting in the **blocked
status** or with a **blocker** recorded, and those whose due date has passed while unfinished. A
count meant to be acted on, not a status. This is the one place a bare blocked status counts
without a recorded blocker — a card parked in Blocked still needs a look.
_Avoid_: at risk, stale, flagged.

**Sprint summary**:
A short AI recap of one sprint, shown on the Sprints → Summary tab, for the whole team or per
person. It groups the tickets that landed into a handful of named **themes** — each one a short
`Title Case Headline - what changed, what changed` line, one per group, not a line per ticket. The
recap is always in English, even when the tickets are not. The carry-over list beside it is not
AI: it is derived from the tickets that did not reach done. Finished sprints are listed
most-recently-finished first, and a finished sprint's recap is generated automatically the first
time its tab is opened, then kept until someone regenerates it; the active sprint's is a manual
live **preview**. Draft, not record — the tab says so. The sprint's numbers live on the progress
strip, not here.
_Avoid_: report, retro/retrospective (no meeting is implied), review, standup.

## Ticketing terms this feature pinned down

These predate sprints but were never written down, and sprints made the ambiguity load-bearing.

**Backlog**:
Work that has been filed but not yet taken on. A workspace has exactly one backlog, and a ticket is
in it by **sitting in the backlog status** — there is no separate backlog list. The backlog is not
part of the board and is excluded from board counts. Leaving the backlog is one-way: a ticket can
never be moved back into it.
_Avoid_: icebox, inbox (the support inbox is a different thing), triage queue, unplanned.

**Blocker**:
A recorded reason one ticket cannot proceed — the ticket that is in the way, plus an optional note.
A property of the ticket, independent of where it sits on the board: a ticket may carry a blocker
while in progress, and may sit in a **blocked status** with no blocker recorded. When something
counts "blocked tickets" it means the ones carrying a blocker — the sole exception is the sprint
**needs-attention** count, which also counts a ticket parked in the blocked status.
_Avoid_: dependency, blocked (bare — that names the status, not the record).
