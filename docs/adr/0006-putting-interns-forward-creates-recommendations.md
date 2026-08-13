# Putting interns forward creates recommendations — a staffing request holds no intern list

## Status

accepted

## Context

A staffing request is demand: a project needing a stated number of interns placed on it. Something
has to record the response — which interns an admin offered for each requested position, and how
each of those offers turned out.

The obvious shape is for the request to own that list: an array of interns per requested position,
with a status on each. It is the shape the request's own UI wants, it needs no reverse lookup, and
it makes "who is on this request" a single read.

It is also the shape that breaks the platform. The application already answers "who is on a
project" from recommendations, and it answers a good deal more besides: a recommendation's
`result.startDate` is the intern's first day, which sets `InternProfile.placedAt`, which exempts
them from attendance from that day on. A second list of interns-per-project would immediately
contradict all of it — a request could say an intern is on Borealis while their recommendation says
they were never placed, and no rule could decide which one the attendance calculation should
believe.

Two alternatives were considered and rejected:

- **A request-owned list that mirrors into recommendations.** Two writes for one fact, and every
  future edit path has to remember both. Mirrors drift; that is what mirrors do.
- **A request-owned list for offers, with recommendations created only on placement.** This loses
  the entire middle of the process — an intern who interviewed twice for a request and wasn't taken
  would have no record of it anywhere, which is exactly the history `interviews[]` exists to hold.

## Decision

**Putting interns forward creates ordinary recommendations. A staffing request never holds its own
list of interns.**

- Each pick creates a `Recommendation` carrying the intern, the request's project, the requested
  position it was created against, and `staffingRequest` pointing back at the request. A requested
  position is identified by `staffingRequest + position` — there is no separate line id.
- The recommendation's `position` is **forced** to the requested position it is created against. It
  is not a free choice in this flow, which is why the position is a path segment on the route
  (`POST /:id/positions/:positionId/put-forward`) rather than a body field.
- Who has been put forward, whether they are still in selection, and whether they were placed are
  **always derived** from those recommendations (`deriveProgress`). Nothing about the response is
  stored on the request.
- Nothing else about a recommendation changes. The existing pipeline, placement and attendance
  behaviour apply untouched, because these are not a special kind of recommendation — they are
  recommendations that happen to know which ask produced them.

## Consequences

- **Progress is a reverse lookup, on every read.** `loadTaggedRecommendations` runs for the list
  route as well as the detail route, batched by request id. `Recommendation.staffingRequest` is
  indexed for it.
- **Three numbers, not one.** Because `putForward` counts every recommendation ever tagged here,
  including ones since resolved, it reports a full pipeline for candidates who are all finished.
  `inSelection` — tagged and not yet `resulted` — is the number that says whether anyone is still
  live. Neither is meaningful alone, and no UI may collapse them into one badge.
- **The project reference is not locked by putting interns forward.** An earlier design froze it
  once anyone was offered. That refusal is gone: repointing a request only ever means the wrong
  project was named, and moving the request moves its tagged recommendations with it (ticket 10). A
  genuinely different project is a new request. The dead `assertProjectEditable` helper went with
  the rule.
- **An already-placed intern can be put forward.** `createRecommendation`'s
  `NON_RECOMMENDABLE_PROFILE_STATUSES` guard is deliberately not applied to this path — it protects
  the ad-hoc flow, where offering a placed intern is almost always a slip. Here it is a deliberate
  act the admin was warned about by name of project, and refusing it would only push them to create
  the recommendation by hand. Discontinued and completed interns are still refused, in the picker
  rules and again server-side.
- **Closing a request has something to cascade over.** ADR 0004's close-out only works because the
  candidates are recommendations; there would be nothing to resolve if they were rows on the
  request.
