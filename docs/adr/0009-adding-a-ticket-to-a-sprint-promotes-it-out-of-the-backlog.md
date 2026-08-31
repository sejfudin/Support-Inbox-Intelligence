# Adding a ticket to a sprint promotes it out of the backlog

## Status

accepted

## Context

The backlog is a status, not a list: a ticket is in the backlog by sitting in the workspace's single
`isBacklog` status, and `resolveStatusTransition` refuses to put it back — *"Tickets cannot be moved
back to the backlog."* That rule was written for board drags, where moving work backwards into the
holding pen is meaningless. Backlog tickets are also excluded from the board and from board counts.

Sprint planning collides with all of that. The obvious source of work for a new sprint is the
backlog, and the create-sprint modal drags tickets straight out of it. But if sprint membership were
orthogonal to status, a backlog ticket added to a sprint would keep its backlog status and therefore
render in no column of the sprint board — the sprint would claim fourteen tickets and show three.

Three ways out were considered.

- **Keep them orthogonal and accept the empty columns.** Rejected: the sprint board is the feature,
  and it would be wrong from the first ticket added.
- **Refuse backlog tickets, so sprints only accept already-triaged work.** Honours the existing rule
  at no cost, but leaves planning with no path from the backlog — which is where the work is. A
  separate manual promotion step before every sprint is the same promotion, done twice.
- **Make adding to a sprint perform the promotion.** Keeps the one-way rule intact and gives it a
  second sanctioned exit alongside the details modal.

## Decision

**Adding a ticket to a sprint moves it out of the backlog into the workspace's default main status,
in the same operation.** Sprint membership and status stay separate fields; adding is the one action
that writes both.

- The promotion runs through the existing ticket-update path, so status lifecycle side effects,
  history lines and socket events all happen exactly as they do for any other status change.
- **Removing a ticket from a sprint is deliberately not the inverse.** It clears the sprint and
  leaves the status untouched — the ticket stays on the board wherever it had reached. Nothing sends
  a ticket back to the backlog, and the existing rule keeps refusing it.

## Consequences

- A ticket dropped into an *upcoming* sprint is promoted immediately, days before that sprint starts.
  On the main board it is indistinguishable from work in flight. Accepted: the alternative is a
  deferred promotion that fires on a date, which reintroduces the scheduled state this design spent
  ADR 0010 removing.
- Pulling a ticket out of a sprint by mistake cannot be fully undone — re-adding it restores the
  sprint but the backlog status is gone for good. The remedy is the same as for any wrong status.
- The backlog shrinks as a side effect of planning rather than by an explicit grooming step. That is
  the intent, but it means the backlog is no longer a complete picture of uncommitted work: tickets
  promoted into a future sprint have left it.
- Reversing this means either accepting empty sprint columns or relaxing the one-way rule, and
  relaxing that rule reopens what a ticket's accumulated time and `doneAt` mean once it can go
  backwards.
