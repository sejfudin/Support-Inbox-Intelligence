# Closing a staffing request closes out everyone still in selection for it

## Status

accepted

## Context

A staffing request is demand; the recommendations created from it are the response. When the demand
ends, the response is left dangling: interns sit in `recommended` or `interviewing` for an ask that
no longer exists. Somebody has to walk each record and resolve it by hand, one at a time, and
nobody does — so the pipeline fills with processes nobody is running, and the intern's own
dashboard keeps telling them they are being considered for something that is over.

The original design made this worse on purpose. Cancelling was specified to write **nothing** to any
recommendation, on the reasoning that demand is a fact about the outside world and shouldn't touch
anyone's record. That is true in principle and unhelpful in practice: the cleanup it leaves behind is
exactly the work the feature existed to remove, and it lands on the admin rather than on the person
who withdrew the ask.

Alternatives considered:

- **Leave the recommendations alone** (the original design). Rejected: it is the status quo the
  feature was built to replace, just with a request record next to it.
- **Untag them** — clear the `staffingRequest` reference and let the recommendation live on as an
  ordinary one. Rejected because a null `staffingRequest` is the *normal* shape: admins create
  recommendations directly all the time. Untagging therefore doesn't mark a record as orphaned, it
  makes it indistinguishable from one an admin deliberately initiated. The system loses the
  difference between a live process and a dead one.
- **Delete them.** Rejected: `interviews[]` carries hand-written evaluative data — `feedback.summary`,
  `strengths`, `concerns`, `rating`, who interviewed and when — and it exists nowhere else. An intern
  who sat two interviews before the client pulled out would have that erased, and their record would
  claim they were never in a process at all. Deleting is also irreversible in a flow that fires on
  many records at once.
- **A third outcome** (`withdrawn` alongside `placed` / `not_placed`). Rejected: it breaks every
  query that filters on `not_placed`, and the distinction it encodes is better carried by a flag (see
  the decision).

## Decision

**Closing a staffing request resolves every recommendation still in selection for it as
`not_placed`, marked as caused by demand ending. This fires for all three close reasons, and the
same cascade fires when a requested position is changed or removed.**

- **All three reasons, no exceptions.** Cancelled, declined and fulfilled all leave the same stale
  pipeline behind, so all three clear it. Fulfilled included: two placed out of six put forward means
  four people are done being considered.
- **Cancelled means cancelled.** There is no per-intern opt-out, no checkbox list, and no carve-out
  for someone with an interview booked. If the ask is partly alive, the correct action is to **lower
  the count**, not to cancel — two actions, each doing one thing completely, instead of one action
  with escape hatches. Lowering a count closes out nobody, because nothing can pick *which* of the
  candidates to drop.
- **Placed interns are never touched.** Placement is a fact about the intern, not about the demand.
- **One shared reason, mandatory, for everyone closed out.** No per-intern text field. The dialog
  says so, and points the admin at individual recommendations if they want to say something specific
  to one person — which is a deliberate, one-at-a-time act, not a bulk one.
- **The reason is written for an internal audience.** `formatOwnRecommendation` deliberately withholds
  `result.note` from interns, alongside interview feedback and the admin's pitch. So the shared reason
  is read by admins, leadership and mentors — never by the intern it is about.
- **`result.demandEnded` (boolean) carries the distinction to the intern.** Without it, a closed-out
  record and "we interviewed you and chose someone else" are identical on the intern's dashboard. The
  flag drives fixed intern-facing copy — *"This opportunity closed before a decision was made about
  you"* — with no free text and no leak. It is set **only** by the cascade: `applyResultPayload`
  must not accept it from a payload, or an admin could label a genuine rejection as demand ending and
  the intern would be told the opportunity was withdrawn when they were actually turned down.
- **Whoever may close may trigger it.** Cancelling is leadership-only, so this is the platform's
  first non-admin-caused write to a recommendation. `result.decidedBy` recording a leadership user is
  correct, not a bug — they did decide it. `.claude/docs/security.md` gains the qualification: only
  admins write recommendations *directly*; the staffing-request cascade writes them on behalf of
  whoever legitimately closed the request.
- **Nothing closes itself.** A request never auto-closes on demand met, because the cascade requires
  a mandatory reason and nothing unattended can write one. Demand met surfaces as a banner on the
  admin's view — one click into the same dialog. Leadership does not see that banner; they cannot act
  on it.

## Consequences

- Interns acquire `not_placed` records for reasons that have nothing to do with them. This is the
  accepted cost, and `demandEnded` is what stops it reading as a judgement — both to the intern and
  to any future placed-vs-not-placed metric, which must exclude these. Nothing computes such a metric
  today (`adminDashboardService.js` only ever queries `'result.outcome': 'placed'`), which is why the
  earlier worry about skewed conversion was weaker than it looked.
- Progress needs a third number. `putForward` counts every tagged recommendation regardless of
  outcome, so after a cascade a request would report a full pipeline that is entirely dead. It now
  reports **wanted / put forward / in selection / placed**, where *in selection* is the tagged
  recommendations not yet resulted.
- The edit lock on requested positions narrows. Previously a position could not be removed once
  *anyone* was put forward for it; now the cascade handles that case, and the only remaining refusal
  is a position with someone **placed** against it — where removal would delete the request's record
  of a placement it produced.
- Changing a request's **project** is the one operation that does *not* cascade: it moves every tagged
  recommendation with the request instead. Repointing a request only ever means the wrong project was
  named, and a genuinely different project is a new request. Interview rows carry their own free-text
  company and role, which are deliberately not rewritten, so a moved record keeps a visible trace of
  where it came from.
- Reversing this decision means finding the closed-out records (they are identifiable — `demandEnded`
  plus their `staffingRequest`), and accepting that any un-resolution fights the one-way status rule
  in `updateRecommendation`.
