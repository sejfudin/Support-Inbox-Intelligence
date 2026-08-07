# Workspace Dailies

## Status

accepted

## Context

We want daily standups for internship teams. A standup is a live meeting where the team's
interns sit down and one person (the scribe) records, per intern, what was done, what's
next, and blockers. The team unit is the `Workspace` (the multi-tenant ticketing container
with `members[]`), so each workspace has its own Daily.

This is unrelated to the `Project` reference entity (firm-global client engagements used by
recommendations) — despite the word "project", Dailies never touch it.

The branch also already carries an **Attendance** feature (intern self-check-in, hub-based,
07:00–11:00 window, currently mock-backed). A Daily records presence implicitly (an intern
with an entry is present), a second, different notion of attendance. We deliberately did not
reconcile them yet.

## Decision

A **Daily** is scoped to a `Workspace`, unique per `(workspace, date)`. Re-creating for a
date that already has one opens the existing record.

**Entries are added as-you-go — there is no prefill.** A Daily starts empty. The scribe adds
one **entry** per intern via the "Add standup entry" modal (pick an intern, fill it in). An
entry holds: `member` (an intern), `done` (array of short text items), `todo` (array of short
text items), and `blockers` (array of `{ text, linkedTicket }`, where `text` is required and
`linkedTicket` is an **optional single** ref to a ticket in the same workspace). All text
stored verbatim like comments — no HTML sanitizer.
There is **no `present` field**: presence is implicit — an intern with an entry attended, an
intern with none is simply absent for that day.

Entries are **interns only** (`user.role === 'intern'`). The modal's member picker offers the
workspace's active interns **that don't already have an entry** for that Daily. Mentors/admins
scribe but never get an entry of their own.

The header shows four derived counts: **Team covered** (`entries.length / current active
interns` — an attendance ratio, e.g. 4/6, computed live at view time), **Shipped** (total
`done` items across entries), **In flight** (total `todo` items), **Blockers** (total blocker
items).

**Scribe is not an assigned role.** Nothing daily-related happens at workspace creation.
A Daily is created **lazily**: the first person to open the Dailies tab on a day with no
Daily yet starts it (empty) and is recorded as `scribe` — attribution only, not a granted
power. A day nobody records simply has no Daily (a gap). No scheduler pre-creates them.

**Any active workspace member can scribe** (create/add/edit) — the `scribe` field is just the
creator/last-editor, and it rotates naturally day to day. Editing is allowed only while the
Daily is in its **edit window** — its date up to one working day in the past (weekends
skipped) — after which it is read-only. Read access follows the ticket rule: any active
workspace member, plus platform admins who bypass membership (`helpers/workspaceAuthz.js`).

**Presence is standalone.** Having an entry is not wired into the existing self-check-in
Attendance feature. Integration is deferred until that feature is finished.

UI: a **Dailies** sidebar item opening the current workspace's Daily plus date history. A
dashboard aggregation is deferred until sibling features land and can be combined at once.

No hard delete (Dailies persist as history; entries can be cleared). No `History` audit log
for Daily edits in v1. "Today" and the edit window use server-side dates, not per-user
timezones.

## Considered options

- **Async 3-question standup (each member self-submits)** — rejected: the real process is a
  live meeting with one scribe recording for everyone.
- **Team-level blob instead of per-intern entries** — rejected: we want per-intern history
  ("what did X say last Tuesday") and per-intern presence.
- **Plain-text done/todo/blockers** — rejected in favour of item arrays; the standup UI lists
  discrete items per column, and blockers need per-item ticket links.
- **Interactive checklist (tickable todo items)** — rejected: items are just text, not a task
  list with persisted checked-state.
- **Prefill/allow non-intern entries** — rejected: entries are interns only.
- **Prefill all interns + explicit present/absent toggle** — rejected in favour of add-as-you-go:
  the scribe adds an entry per intern who reports; presence is implicit (has entry), so there is
  no `present` field and no explicit absent marking.
- **Snapshot the expected roster at creation (fixed `X/N`)** — rejected: the covered
  denominator is the current active-intern count, computed live. Simpler; past ratios drift as
  the roster changes, which we accept.
- **Merge presence into the existing Attendance feature now** — deferred, not rejected:
  revisit once the self-check-in feature is complete.

## Consequences

- A zero-intern workspace produces an empty Daily (valid).
- `linkedTickets` can dangle if a ticket is later archived/deleted — the UI must render
  such refs gracefully.
- An intern with no entry is absent, but there's no record distinguishing "was away" from
  "scribe didn't get to them" — presence is implicit only.
- A past Daily's `covered` denominator drifts as interns join/leave the workspace, since it's
  the live active-intern count, not a snapshot.
- Two notions of "attendance" coexist until the deferred reconciliation.
