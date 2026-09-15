# A past sprint's numbers are sealed on the first read after it ends

## Status

accepted

## Context

Every sprint number — progress, point and ticket totals, needs-attention — is an aggregation over
`Ticket.sprint` computed at read time (ADR-0011). Nothing is stored. That is right for a running
sprint: the numbers follow the board, and there is no cache to go stale.

It is wrong for a finished one. Membership is a single reference on the ticket, so moving a ticket
into a new sprint removes it from the old one. Carrying a leftover forward therefore rewrites the
history of the sprint that failed to deliver it: its total shrinks, and its done-percentage rises.
This was observed, not theorised — a past sprint holding two tickets reported one after a single
leftover was carried, so the sprint that missed the work ended up looking as though it never had it.

The Past tab is specified as a record: finished sprints listed "with their final numbers", frozen,
"a record rather than a workspace". With live aggregation there are no final numbers to show, only
current ones that drift downward as leftovers leave.

Something has to write the numbers down. The question is what triggers the write, and ADR-0010 rules
out the obvious answer: there is no *Complete sprint* button and no scheduled job, because a sprint's
state is read off the calendar. There is no moment at which the application is told a sprint ended.

## Decision

**A sprint's numbers are sealed onto the sprint the first time it is read after its end date has
passed. Past sprints then serve the sealed copy and never recompute.**

- The sprint document gains a snapshot field, null until sealed.
- Any read that derives a sprint's state — the list, `GET /sprints/current`, read-by-id, and the
  leftovers read — seals a sprint it finds to be past and unsealed, then returns the sealed values.
- A sprint that is upcoming or active is never sealed, and its numbers stay live.
- Sealing is idempotent and write-once. A sealed sprint is never resealed.

Sealing on read rather than on a clock keeps ADR-0010's bet intact: the calendar remains the only
thing that decides what a sprint is, and no job has to run for the data to be correct.

The leftovers read is the one that matters most, and it is deliberately on the list. It reads the
previous sprint before offering anything to carry, so the sprint is sealed *before* the membership
write that would have rewritten it.

## Consequences

- **ADR-0014 depends on the ordering here.** The rollover it describes seals the ending sprint
  before it creates a successor or moves a single ticket, for exactly the reason set out above.

- **The seal captures the state at first read, not at midnight on the end date.** If nothing reads a
  sprint between its end and some later change to its tickets, the snapshot records the later state.
  In practice the leftovers read closes the path that matters, because carrying forward is the only
  routine way a finished sprint's membership changes. Archiving a ticket in an unsealed past sprint
  is the remaining hole, and it is not worth a scheduler to close.
- **Reads now write.** A `GET` can persist. That is a real cost — it means a read path can fail on a
  write error, and it puts a write inside a request that callers assume is safe to retry. Sealing is
  idempotent, which makes the retry harmless.
- Past sprints stop reflecting later ticket edits of any kind. That is the point: a record that
  updates is not a record. A ticket finished after its sprint ended does not improve that sprint.
- The snapshot is the schema's first stored aggregate. It must be written by the same helper that
  computes the live numbers, so a live sprint and a sealed one cannot disagree about what the numbers
  mean.
- Reversing this is cheap for the field and expensive for the data: dropping the column returns the
  drifting behaviour, and no recomputation can recover a sealed sprint's real numbers, because the
  tickets that left it are gone.
- Burndown remains out of scope. This seals one set of numbers at one moment; it is not the daily
  snapshot history a burndown needs, and it does not become one.
