# Staffing requests

Leadership records demand that arrived from outside the platform; admins answer it by putting
interns forward, which creates ordinary recommendations. This is the only leadership write path on
the platform.

Read alongside this file:

- `CONTEXT.md` § "Staffing requests" — the canonical terms (**staffing request**, **requested
  position**, **putting interns forward**, **closing**, **closing out**) and what each one is *not*.
- `.claude/docs/security.md` § "Staffing requests" — per-route and per-close-reason authorization,
  which reasons demand a stated one, and the 403-vs-400 mapping. Not restated here.
- `.claude/docs/architecture.md` § "Recommendations" — the lifecycle every candidate a request puts
  forward then moves through.
- `docs/adr/0003`–`0006` — the four decisions this feature rests on.
- `.scratch/staffing-requests/` — the spec and the implementation history.

## The model

**`StaffingRequest`** (`server/models/StaffingRequest.js`) — not workspace-scoped, matching
`Project` and `Recommendation`.

- Project identity is **at least one** of `project` (ref) or `draftProject` (embedded
  `name`/`client`/`description`), enforced in `pre('validate')`. `draftProject` is kept forever as
  evidence of what was originally asked for, so the two coexist once resolved.
- `requestedPositions` is an embedded array of `{ position, count, technologies[] }` with a path
  validator rejecting a repeated `position`. **A requested position is identified by
  `staffingRequest + position`** — there is no per-row id, so changing a position and removing one
  are the same event.
- `author`, optional `neededBy` (real `Date`, no free-text fallback).
- `status` is `open | closed`; closing sets `reason` (`fulfilled | declined | cancelled`),
  `closedBy`, `closedAt`, enforced together by `pre('validate')`.
- **`note` is the admin's remark on the request, not the author's ask** — one per request, written
  when the admin closes it, carrying `noteBy` + `noteAt` (a `pre('validate')` hook requires all
  three or none, since a half-written note would render unattributed). Leadership never authors it:
  create/update ignore `note` entirely. A cancellation's reason goes to the separate `closeNote`
  field precisely so cancelling cannot overwrite an admin's note.
- **`closed` is terminal: no reopen, no delete, no write of any kind to a closed request**
  (`docs/adr/0005`) — the close carries its own reason precisely because nothing can add one later.

## The rules module

**`helpers/staffingRequestRules.js`** is the single pure rules module for the feature (no I/O, no
clock — timestamps passed in), following `helpers/specializationRules.js` and unit-tested with
plain objects in `staffingRequestRules.test.js`. Services carry out its verdicts and never
re-derive them:

- `deriveProgress` — requested positions + tagged recommendations → per-position
  `{ wanted, putForward, inSelection, placed }` and totals. A tagged recommendation whose position
  isn't in the request is ignored rather than crashing. **`putForward` counts every tagged
  recommendation regardless of outcome; `inSelection` counts the ones not yet `resulted`. The two
  are not interchangeable and no screen may collapse them** (`docs/adr/0006`).
- `needsProject` / `assertCanResolveProject` — `needsProject(request)` is `!request.project`;
  `assertCanClose` calls it directly to refuse `fulfilled` while it holds, server-side rather than
  merely hidden in the UI. `assertCanResolveProject` refuses a request that already has a project,
  or is closed.
- `partitionPickerCandidates` — intern profiles + their recommendations → `excluded` (discontinued,
  completed, or already put forward for this requested position) / `warned` (already placed, or in
  selection on another project, flagged with which) / `clean`. Excluded interns are dropped by the
  service rather than returned; warned ones are shown and selectable. A `placed`/`in-selection` flag
  carries `unknownProject: true` when one of the conflicting recommendations has no project of its
  own — `Recommendation.project` is nullable, and two nulls are neither equal nor different, so no id
  comparison can say whether that recommendation is the same opportunity as the one now being staffed
  or a second one. The flag still fires (an unnamed conflict is not the same as no conflict), and the
  client writes copy that admits the ambiguity instead of naming a project.
- `assertCanPutForward` — admin only, request open, project resolved. The last is not about
  `Recommendation.project` being required (it isn't) — it's that the request's own project is what
  pre-fills every recommendation a submit creates, so there has to be one to pre-fill from.
- `assertCanClose` / `applyClose` — close legality in one sentence: **leadership withdraws, admin
  answers**. Also takes `inSelectionCount` and requires a `notPlacedReason` exactly when that is
  above zero. The per-reason permission split, which reasons demand a stated one, and the
  403-vs-400 mapping are all in `.claude/docs/security.md`. There is no `assertCanReopen`.
- `planStaffingRequestEdit(request, { requestedPositions, projectId }, recommendations)` — every
  legality question and consequence of an edit in one call, returning
  `{ endingPositionIds, closeOutCount, projectChanged, movingCount }`.
- `selectCloseOutRecommendations(recommendations, positionIds)` — which candidates a close (or an
  edit that drops demand) resolves: tagged, still in selection, for one of `positionIds`. Placed
  interns fall out for free, since a placement is already `resulted`. Position-scoped so the edit
  path reuses it for a single changed or removed position.
- `deriveUnreadStaffingRequestIds` — see News feed below.

## The response shape

**Formatted request payload** (`formatRequest` in `services/staffingRequestService.js`) — the one
place a request document becomes a response: adds `progress` (straight from `deriveProgress`) and
`suggestions`, one entry per tagged recommendation
(`{ id, position, internName, internProfile, startDate, technologies[], status, outcome }`), so the
UI can group suggested interns under the requested position they were put forward for. There is no
derived status field. **`position` stays a raw id on purpose** — `deriveProgress` matches it against
`requestedPositions` by id, so populating it would silently break every progress count.

## How a request reaches the recommendations

**Tagging recommendations** — `Recommendation.staffingRequest` is a nullable ref set only when the
recommendation was created by putting an intern forward
(`recommendationService.createRecommendationsForStaffingRequest`); the position is forced to the one
it was created against (`docs/adr/0006`). `RECOMMENDATION_RESULTS` is untouched — an intern closed
out when the demand behind their process ends is still `not_placed`, with the difference carried by
`result.demandEnded` (`docs/adr/0004`).

**`Recommendation.result.demandEnded`** (Boolean, default `false`) — this `not_placed` was caused by
the demand ending, not by a decision about the intern. Written **only** by the cascade;
`applyResultPayload` ignores it on the way in, carries a stored `true` over while the record stays
`not_placed`, and drops it the moment the outcome changes. It is the one part of `result` besides the
outcome and dates that reaches the intern (`formatOwnRecommendation` still withholds `result.note`),
where it swaps "Not placed this time" for "This opportunity closed before a decision was made about
you". **Any future placed-vs-not-placed metric must exclude these.**

## Resolving a draft project

`resolveStaffingRequestProject` (link an existing project) and
`resolveStaffingRequestProjectByCreating` (create one, then link), at `POST /:id/resolve-project` and
`POST /:id/resolve-project/create`. Both admin-only, checked directly in the service rather than
through the author-or-admin `assertWriteAccess` — leadership can describe a project, never create or
link one. `type`, `status` and `technologies` are never seeded from the request (leadership never
classifies a project); `name`/`client`/`description` are prefilled from `draftProject` on the client
only and stay editable. The create path returns `{ existingProject }` in a 409 on a `Project.slug`
collision rather than a raw `E11000`. Fuzzy name matching against the draft
(`frontend/src/helpers/projectMatch.js`, pure — the project list is already loaded) puts "possible
matches" ahead of "create new".

## Putting interns forward

The feature's load-bearing write. Two admin-only routes, with
deliberately different shapes:

- `GET /:id/positions/:positionId/candidates` reads the picker for **one** requested position (the
  position is a path segment because an intern is offered for the discipline that was asked for,
  never out of one flat list), returning rows already partitioned by `partitionPickerCandidates`
  plus the position's technologies.
- `POST /:id/put-forward` is **request-level** and takes the whole staged cart in one body:
  `{ groups: [{ positionId, internProfileIds }], projectId? }`. The position is still never a free
  choice — it is the key of the group and must be one the request asked for. Every recommendation
  the submit creates is pre-filled with the request's own resolved `project`; sending an explicit
  `projectId: null` deliberately discards that pre-fill for the whole submit (the admin ticked
  "unknown" on the form) — any other value is not a legal override and is ignored.
  `createRecommendationsForStaffingRequest` `insertMany`s one recommendation per pick across every
  group in a single write, tagged with `staffingRequest`, logs each one's initial status event, and
  emits `emitInternDataChanged()`. The request itself is never written (`docs/adr/0006`).
- The picker rules are **re-checked server-side per group** (a cart goes stale while staged), and
  refusals come back **all-or-nothing** as `409` with
  `data.rejections = [{ positionId, internProfileId, reason }]`, so the client marks the offending
  rows rather than failing the whole form with one message.
- **One submit is one answer**: exactly one `staffing:put_forward` history event per submit, naming
  the total across every position, and exactly one leadership badge. Individual placements
  deliberately do not badge.

## Closing, and closing out its candidates

`POST /:id/close` is the only thing that ends a
request, and it ends the whole thing: whatever the reason, every candidate still **in selection** is
resolved `not_placed` with `result.demandEnded` and one shared reason. Placed interns are never
touched. Both ADRs behind this are load-bearing: `docs/adr/0004` (the cascade, and why not
untag/delete/third-outcome) and `docs/adr/0005` (no reopen).

- Body is `{ reason, note?, notPlacedReason? }`. `notPlacedReason` is required exactly when at least
  one candidate is in selection, is written to every closed-out record's `result.note`, and has
  **no** per-intern variant — a person-specific reason is written on that person's recommendation,
  one at a time.
- The cascade is `recommendationService.closeOutRecommendationsForDemandEnd(user, {
  staffingRequestId, positionIds, reason, action })` — a reusable unit, called from both the close
  and the edit path. Per record it writes the result, stamps `statusDates.resulted`, and appends its
  own `recommendation` history row (shared with the placement auto-close via `resolveAsNotPlaced`);
  then it returns each intern to the ready bench (`status: 'ready'`, exemption lifted via
  `closePlacementExemption` — never a bare `placedAt = null`, see `.claude/docs/architecture.md`)
  **unless they hold a placement elsewhere**, and emits `emitInternDataChanged()`. It returns
  `{ closedOutCount }`, which the caller names in the trail.
- The cascade runs **after** the request is saved, so a failure leaves a closed request with a
  retryable close-out rather than a dozen resolved people on a still-open one.
- Nothing auto-closes. Demand met renders a "Close as fulfilled" button inside the existing blocker
  banner on the admin pane only (keyed off `blocker.key === 'demand-met'`); leadership never sees
  it, and keeps Cancel with no Reopen.

## Editing an open request

`PATCH /:id` accepts `requestedPositions`, `neededBy`, `projectId` and
`draftProject` (never `note`), and carries out `planStaffingRequestEdit`'s verdict.

- **A position that stops being asked for closes out its candidates**, through the same cascade
  under the same mandatory `notPlacedReason`.
- **The one refusal: a position with someone `placed` against it**, as a 400 naming the intern
  ("Frontend can't be changed, Ana is already placed against it"). Lowering a `count` closes out
  nobody and may go below what is already placed — "1 wanted, 2 placed" is legal.
- **Changing the project moves every tagged recommendation with it** (`updateMany` +
  `emitInternDataChanged()`), with no refusal, including for placed interns: repointing only ever
  means the wrong project was named. Interview rows keep their own free-text `company`/`role`,
  deliberately un-rewritten. Naming the *first* project is still resolution (admin-only), so the
  edit path refuses it.
- `draftProject.name/client/description` stay editable **before and after** resolution — the trail
  records both versions, which protects the original ask better than freezing it did.
- **There is deliberately no project lock**: putting interns forward never freezes the project
  reference.
- Editing is **the author's alone** — route-gated to `LEADERSHIP` and narrowed to the author in
  `assertWriteAccess`, matching the leadership shell, the only screen that mounts the form.

## News feed

Both shells learn about staffing-request activity without a bell. Deliberately
doesn't use `Notification` (`docs/adr/0003`): the history log itself is the notification.

- `History.entityType` gains `'staffingRequest'`. Every event is appended via
  `historyService.logStaffingRequestEvent` with a **namespaced** `statusKey` (`staffing:filed`,
  `staffing:project_resolved`, `staffing:put_forward`, `staffing:closed`,
  `staffing:positions_changed`, `staffing:project_changed`, `staffing:draft_edited`,
  `staffing:edited`) — namespaced because `statusKey` is a string space shared with recommendation
  stage tracking, where bare `placed` already means something.
- Unlike every other history write, this one is **awaited and its errors surfaced** (see the comment
  at `staffingRequestService.createStaffingRequest`) — a lost row means leadership/admin silently
  never finds out, not just a missing log line.
- `User.staffingRequestsLastSeenAt` (Date, nullable) is the per-viewer read marker. Never opened ⟹
  `null` ⟹ every existing event counts as news, not zero.
- `deriveUnreadStaffingRequestIds` is pure: raw `{ entityId, userId, timestamp }` events plus
  `{ lastSeenAt, viewerId }` → the request ids with news. Excludes events the viewer caused; an event
  exactly at `lastSeenAt` does not count (must be strictly newer). `getStaffingRequestNews` runs
  fetched events through it rather than reimplementing the policy as a Mongo aggregation.
- Three reads: `GET /news` → `{ count, requestIds }`, `POST /seen`, and `GET /:id/history` (newest
  first, no populate — actor name comes from the denormalized `userName` on each row).
- New index `History.{ entityType: 1, timestamp: -1 }` — the existing
  `entityType, entityId, timestamp` is scoped to a single entity and can't answer "which entities of
  this type have an event newer than X".
- Socket key `staffing-news:all` — global like `intern:all`, fired on every staffing-request history
  write, handled on the client by invalidating the news query key. That is its only consumer, so no
  per-row query needs its own subscription.

## Frontend

Paths below are relative to `frontend/src/`. The two sides do not share a detail pane — leadership is
`pages/fep/LeadershipRequestsPage.jsx` → `components/symphony/requests/RequestDetail.jsx`, the only
screen that mounts the edit form; the admin is `pages/AdminStaffingRequestsPage.jsx`
(`/admin/staffing-requests`, admin-only), laid out list / detail / rail. Both sides' per-position
cards share their chrome through `components/symphony/requests/RequestPositionCard.jsx`. Three things
about this layer are load-bearing rather than cosmetic:

- **Picks are staged client-side, never persisted server-side** (`hooks/useStagedPicks.js`, keyed
  `requestId → positionId → picks`, mirrored to `sessionStorage` so a refresh doesn't discard unsent
  work). A staged pick is an intention the server has never been told about, so nothing can be read
  back off it and no model holds it — changing that needs its own ADR. Only ids are submitted; the
  cart also carries display fields because the seat groups show staged picks for every seat while
  candidates are fetched only for the armed one. An intern staged on one seat is excluded from the
  rail for the request's other seats, the same as genuinely put-forward interns.
- **Client-side impact previews must stay worded identically to the server's refusals.**
  `helpers/staffingRequests.js` derives the edit counts and the placed-intern message
  (`getEditImpact` / `describePlacedRefusal`) and the close-out count (`getLeftoverSuggestions`), so a
  pre-flight dialog and the 400 behind it can never disagree. Presentation predicates live here too;
  safe because presentation never authorizes — the rules module's `assert*` functions stay the only
  authority.
- **The admin page reuses the leadership `symphony-*` components** inside its own
  `data-surface="symphony"` div, since those styles are scoped to that attribute and the page lives in
  the sidebar shell, not `SymphonyLayout`.

