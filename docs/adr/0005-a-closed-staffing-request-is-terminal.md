# A closed staffing request is terminal — there is no reopen

## Status

accepted

## Context

Reopening was originally specified so that a request whose demand came back would keep its original
filing date and its whole trail, instead of pretending the demand was new. That reasoning stopped
holding once closing began to **close out** everyone still in selection (ADR 0004): a reopened
request comes back with nobody live, so it is a fresh request wearing an old date, while its notes
still explain why it was cancelled.

Restoring the closed-out candidates alongside it was considered and rejected. It needs a per-record
marker for "the cascade did this, not a human", it writes to each intern's record a second time
purely to undo the first write, and it fights the deliberate one-way status rule in
`updateRecommendation` ("Recommendation status can only move forward").

That left reopen serving two cases:

- **The demand came back.** Better served by filing a new request — and the service already says as
  much: a second wave of demand months later is legitimately its own request.
- **Someone closed the wrong request.** Genuinely has no substitute. Filing a new one leaves a bogus
  closed request in the list forever and splits the trail across two records.

The remaining question was whether that second case justifies the machinery. It does not: the cost is
clutter and a duplicate recommendation per affected intern, not data loss, and the bogus closed
request is honest history — someone really did close it.

Reopen also acquired an authz problem the moment cancelling became leadership-only. Reopen was
author-or-admin, so an admin could resurrect an ask leadership had deliberately withdrawn.

## Decision

**`closed` is terminal. There is no reopen, and there is no delete.**

- No `assertCanReopen` / `applyReopen`, no reopen route, no reopen button, and no mirrored
  who-may-undo-which-close rule.
- **The close dialog must state that it is permanent** and name the consequence — *"This can't be
  undone. 4 interns still in selection will be closed out."* This is the only warning a user gets.
- **Notes stay writable on a closed request.** Previously blocked; now load-bearing. It is how a
  mistake gets annotated (*"cancelled in error, refiled as #52"*) and how returning demand is
  cross-referenced (*"client back in Q3, see #61"*).

## Consequences

- A mis-close is permanent, and its cascade has already resolved the affected interns. Those interns
  end up with a `demandEnded` record plus a new live one when they are put forward again on the
  replacement request. Acceptable: the picker makes re-offering them one action, and their history is
  truthful about what happened.
- `status` becomes genuinely two-valued with one direction, so no screen needs to explain a request
  that is open again but empty.
- The user stories about reopening a cancelled request, reopening a fulfilled one when a placement
  falls through, and being told about a lost placement in order to decide whether to reopen all fall
  away. **Placement lost** as an event is not part of this decision — but with nothing to reopen, it
  is a notification with no action attached, and should be reconsidered on its own merits rather than
  kept because reopen used to exist.
- Reversing this is cheap in code (restore the two rule functions and the route) but not in meaning:
  it would need an answer for what a reopened request does about the candidates it closed out, which
  is the question that killed reopen in the first place.
