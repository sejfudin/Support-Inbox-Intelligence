# A sprint rolls over on read when nothing follows it

## Status

accepted

## Context

A sprint's dates are optional to type: leaving them out gives a two-week sprint starting the day
after the last one ends (`defaultSprintWindow`). That is a create-time convenience and needs no new
machinery. The second half of the same request does: **when the current sprint ends, the next one
should appear on its own, carrying the work that did not get done.**

That needs a moment at which the application knows a sprint ended — and ADR-0010 removed exactly
that. Its decision reads _"There is no state field, no start/complete action, and no scheduled job"_,
on the argument that a `state` field reconciled by a cron is a cache of the dates, free to drift
between runs. ADR-0012 then had the same problem for a different reason: a finished sprint's numbers
have to be written down, and there was no event to hang the write on. It answered by **sealing on
read**, explicitly so that "no job has to run for the data to be correct".

So there were two candidates.

- **A scheduled sweep.** There is a precedent — `startDailyReminderScheduler`, a `setInterval` with
  an in-memory `lastRunDateKey` guard. But that guard's own comment scopes it: a same-day restart
  inside the window "could re-fire once", which is "acceptable for a reminder (not data-corrupting)".
  A re-fired rollover creates a second sprint and moves tickets into it. The guard does not transfer,
  and a process-local one cannot promise anything across workers.
- **On read, as ADR-0012 already does.** Reads in this module already write. The calendar stays the
  only thing that decides what a sprint is.

The remaining question was ordering, and it is the same trap ADR-0012 documents. Membership is a
single reference on `Ticket.sprint`, so moving a ticket out of a finished sprint _rewrites that
sprint's history_ — its total shrinks and its done-percentage rises. A rollover that carries tickets
before the sprint it is closing has been sealed would make the sprint that missed the work look as
though it never had it. ADR-0012 records that as observed, not theorised.

## Decision

**A sprint read rolls the workspace over when every sprint in it is past: the ended sprint is
sealed, a successor is created from the same default window the create path uses, and the tickets
that are not done are moved into it with their statuses untouched.**

- The trigger is a read (`GET /sprints`, `/sprints/current`, `/sprints/leftovers`,
  `/sprints/next-window`), not a clock. **Every** sprint read, including the one that only
  prefills the create form: a prefill taken before the rollover hands back the window the
  rollover is about to claim, and the create then fails on dates the server itself supplied.
- **The three writes happen in one order, and it is not negotiable:** seal the ending sprint, create
  the successor, then carry. Steps one and three inverted is the ADR-0012 bug.
- **Concurrency is a unique partial index on `{ workspace, rolledOverFrom }`**, not a lock. Two
  simultaneous reads both reach the insert; one lands, the other takes a duplicate-key error and
  bails, and its caller re-reads and finds the winner's sprint. `Sprint.rolledOverFrom` is null for
  a hand-made sprint, so the index is partial on `$type: 'objectId'` — `$exists` would match every
  explicit null and make the second manually created sprint in a workspace unsaveable.
- **Rollover does nothing far more often than it does something.** `resolveRollover` returns null
  when an active *or* upcoming sprint exists (either one is already a successor), when the workspace
  has no sprints, when the last one ended more than one sprint length ago, or when the workspace
  turned it off.
- **The carry is one `updateMany`, not a pass through `updateTicket`.** A carried ticket keeps its
  status, so there is no transition to run, no `doneAt` to touch, no time-in-status to reopen and no
  history line to write. `deleteSprint` already detaches the same way and for the same stated reason.
- Nothing is decided in the service. `resolveRollover`, `defaultSprintWindow` and
  `partitionSprintCarry` are pure and clock-free like the rest of `sprintRules.js`; the service
  writes what they return.

`Sprint` gains no lifecycle field. State is still read off the dates, so ADR-0010's core bet is
intact — what changes is that a read may now create a sprint as well as seal one.

## Consequences

- **A read can create a document.** ADR-0012 already made a `GET` persist; this makes it persist
  something new rather than idempotently sealing something that exists. The unique index is what
  keeps a retried read harmless, and it is doing more work than the `snapshot: null` filter was.
- **Nothing happens until somebody looks.** A workspace nobody opens for a month has no successor
  sprint, and gets one on the next page load — starting *that day*, not backdated into the gap, so
  it does not arrive already half over. This is the same honesty ADR-0012 has about sealing at first
  read rather than at midnight.
- **An upcoming sprint suppresses the rollover entirely, including the carry.** A team that plans
  its next sprint by hand gets no automatic help with leftovers; the create modal's leftovers tab
  stays the only path. That is deliberate — adding tickets nobody chose to a sprint somebody did
  plan is worse than doing nothing — but it means the feature is invisible to teams who plan ahead.
- **A dormant workspace stops after one.** Without the staleness guard a workspace that ran a single
  sprint in March would grow an empty sprint every fortnight forever off nothing but a page load.
  The cost is a cliff: come back one day past the grace window and the cadence does not resume.
- **An auto-carried ticket has no history line, where a hand-dragged one does.** The card's sprint
  chip changes and `rolledOverFrom` records what happened at the sprint level, but a ticket's own
  timeline does not mention it. Accepted, as `deleteSprint` accepts it. Fixing it means bulk-writing
  one history line per ticket, not looping through `updateTicket`.
- **A crash between the create and the carry leaves a sprint with no tickets in it**, and
  `rolledOverFrom` means the rollover will not retry. The sprint is legal and correct, just empty;
  the leftovers tab is the manual recovery. Closing this properly needs a transaction, which is more
  than the failure is worth.
- **Nobody is notified.** `emitSprintChanged` invalidates the sprint and ticket caches so open
  clients redraw, but no `Notification` is written — a sprint appearing is currently something you
  see, not something you are told. Worth revisiting.
- Reversing this is genuinely cheap: stop calling `rolloverIfDue` and the module is back to
  ADR-0010 plus ADR-0012 exactly, with a `rolledOverFrom` field nothing reads.
