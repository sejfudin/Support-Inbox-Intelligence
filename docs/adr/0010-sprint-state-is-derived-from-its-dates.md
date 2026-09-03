# Sprint state is derived from its dates, and sprints may not overlap

## Status

accepted

## Context

A sprint has to be upcoming, active, or past for the Sprints page to show anything. The conventional
model is an explicit lifecycle — `planned → active → completed` — driven by *Start sprint* and
*Complete sprint* buttons, with dates as advisory metadata.

That model has a failure mode this platform would hit immediately: nobody clicks the button. A sprint
whose end date passed a fortnight ago but still says `active` is worse than no state at all, and the
usual repair is a scheduled job that reconciles state against the calendar — at which point the state
field is a cache of the dates, kept by a cron, and free to drift between runs.

The numbers the screen actually shows were the tell. *Days left*, *ends Sep 12*, `Starts in 2 days` —
every one is computed from the dates and consults no state.

The cost of dropping the field is that "the sprint running today" stops being a lookup and becomes a
date query, which is only unambiguous if at most one sprint can contain today.

## Decision

**A sprint stores only its start and end dates. Its state is computed from today, and no two sprints
in a workspace may overlap.**

- Upcoming, active and past are read off the calendar. There is no state field, no start/complete
  action, and no scheduled job.
- **Non-overlap is validated on create and on every edit**, and is what makes "the active sprint"
  well-defined.
- Editing an active sprint's end date is how a sprint is ended early or extended — the only lever
  needed, since state follows the dates.
- Further date rules: end after start, no backdating a *new* sprint, length between one and eight
  weeks. Working days for *days left* are Monday–Friday, with no holiday calendar.

## Consequences

- **Revisited by ADR-0014**, which adds a lifecycle transition this ADR did not anticipate: when
  every sprint in a workspace is past, a *read* creates the successor and carries the unfinished
  tickets into it. The bet here survives — there is still no state field and still no scheduled job,
  and state is still read off the calendar — but "nothing ever happens to a sprint on its own" is no
  longer true.

- Sprints cannot be run back to back with no gap unless the dates are set adjacently, and during a
  gap no sprint is active. The Sprints page falls back to the next upcoming sprint, so a planned gap
  reads as "starts in 2 days" rather than as an error.
- **A sprint created with today's start date is instantly active, and an active sprint cannot be
  deleted.** The escape hatch for a fat-fingered sprint is to push its start date into the future,
  making it upcoming, then delete it. Indirect, but it keeps "you cannot delete the sprint the team
  is working in" absolute.
- Overlapping experiments — two teams, two cadences, one workspace — are impossible by construction.
  That is the same bet as scoping sprints to the workspace rather than the project; if it turns out
  wrong, both decisions fall together.
- The overlap check is the only guard on the shared calendar, and sprint editing is open to every
  workspace member. It stops the data being ambiguous, not a member being disruptive.
- Reversing this is cheap while sprints are few — add the field and backfill from the dates — but it
  is not just a schema change: it means deciding what an active sprint whose end date has passed
  means, which is the question the derived model exists to avoid.
