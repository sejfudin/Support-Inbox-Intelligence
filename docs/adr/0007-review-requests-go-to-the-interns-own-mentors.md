# A review request goes to the intern's own mentors, never to a picked teammate

## Status

accepted

## Context

We are adding **review requests**: an intern asks someone to look at the work on a ticket, and that
person answers **approved** or **changes requested**. The reviewer has to be chosen from somewhere,
and the obvious source in a ticketing module is the workspace's member list — that is what the
feature was first sketched as ("request a review from the main mentor and/or someone else from the
team").

Two facts pushed against a member picker.

**Nothing links a mentor to a workspace.** `InternProfile.primaryMentor` and `secondaryMentor` are
`User` refs with no membership implication, while every ticket read is workspace-scoped
(`.claude/docs/security.md`). So a reviewer list built from mentors can name someone who gets a
notification whose link 403s, and a reviewer list built from members can omit the one person the
intern actually reports to.

**A review here is mentorship, not a merge gate.** GitHub already has requested reviewers, required
approvals and branch protection, and does all of that better than a re-implementation. The value
this feature adds is the *mentoring* loop — the intern signals "please look", the mentor sees it
where they already read notifications, and the ticket records that it happened.

Alternatives considered:

- **Any active workspace member**, mentors pinned to the top of the picker. Most flexible, matches
  the original sketch. But it makes peer review the default path, and peer review is not the thing
  the programme is trying to record — a teammate's approval says nothing about an intern's progress.
  It also invites a reviewer set of several people, which then needs quorum rules ("does one
  approval close it?") that a mentorship loop has no answer for.
- **Mentors first, workspace members as a fallback.** Keeps the mentor as the one-click default and
  still allows a teammate. Rejected as the worst of both: the reviewer field means two different
  things depending on which branch of the picker was used, and the dashboard card can no longer say
  "reviews you owe your interns".
- **Requester's mentors only, ignoring workspace membership.** Simplest list, but produces
  notifications the recipient cannot act on. Rejected on the scoping rule.

## Decision

**The reviewer is exactly one of the requesting intern's own mentors, and only when that mentor is
an active member of the ticket's workspace.**

- Candidates are read off the **requester's** `InternProfile`: `primaryMentor` (in everyday speech
  the "main mentor", and often a platform admin) plus `secondaryMentor` **only when
  `specializationAssignedAt` is set** — a `secondaryMentor` without that timestamp is legacy junk
  per ADR 0002 and must not appear as a reviewer option.
- Candidates are then filtered to **active members of the ticket's workspace**. A mentor outside the
  workspace is not offered, and the intern is told why rather than shown a dead option.
- **One reviewer per request, one live request per ticket.** Asking again replaces the previous
  request. No reviewer set, so no quorum question.
- **Only interns can request.** Mentors and admins have no `InternProfile`, so they have no
  candidate list; the action does not appear for them. An intern with no `primaryMentor` also has
  no candidates, and sees the same explanation.
- The candidate list is **never a free choice of person** — no teammate, nobody outside the
  workspace, nobody outside the requester's two mentor fields.

## Consequences

- "Waiting on review" always means "waiting on a mentor", so the admin dashboard's review card and
  the tickets-list filter can both be phrased as work the mentor owes, and the count means one
  thing.
- Programme data now drives a ticketing feature: `ticketService` has to read `InternProfile`, which
  the two domains otherwise keep apart (`.claude/docs/architecture.md`). This is the one crossing,
  and it is a read of two mentor fields — not a general dependency.
- An intern whose mentors are all outside the workspace cannot request a review at all. That is a
  real gap, surfaced as "your mentor is not a member of this workspace" — an admin fixing the
  membership is the intended answer, not a widened picker.
- Peer review is not supported and cannot be worked around. If it is wanted later, it is a second
  concept with its own name, not a widening of this one — widening would silently change what every
  existing record meant.
- Reversing this means introducing a member picker, deciding quorum for multiple reviewers, and
  rewording every surface that says "mentor". Meaningful cost, hence this ADR.
