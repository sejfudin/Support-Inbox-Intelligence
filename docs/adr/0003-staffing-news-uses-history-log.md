# Staffing-request news rides the history log, not Notification

## Status

accepted

## Context

Both leadership and admins need to know, without asking anyone, when a staffing request has news
— someone filed, resolved, fulfilled, closed, or reopened one. This needs a badge (an unread count
on a nav entry) and a per-request "who did what, when" trail.

`Notification` already exists and already drives a bell, so it's the obvious first candidate. It
doesn't fit:

- `Notification` hard-requires a `ticket` and a `workspace` reference. Staffing requests are
  neither ticketed nor workspace-scoped — there is no ticket/workspace to hang a `Notification` off.
- Its bell only renders in the sidebar shell. Leadership runs under a separate shell with no bell,
  so a `Notification`-based badge would need a second rendering surface invented for one feature.

Alternatives considered:

- **Stretch `Notification`**: make `ticket`/`workspace` optional, add a rendering surface in the
  leadership shell. Works, but turns a model with one clear meaning ("a ticket-shaped thing
  happened in a workspace you're in") into two unrelated meanings, and the second one drags a bell
  UI into a shell that doesn't have one for anything else.
- **A dedicated `StaffingRequestNotification` model**: correct shape, but it's a second append-only
  log of "something happened to entity X at time Y" sitting next to `History`, which already
  records exactly that for every other entity in the system, for no clear reason.

## Decision

**The staffing-request history log doubles as the notification mechanism. No `Notification` row is
ever created for staffing-request events.**

- `History` gains a `staffingRequest` entity type. Filing, resolving, fulfilling, closing,
  cancelling, and reopening a request all append an event here — this is also the feature's audit
  trail, shown in full on the request's detail view.
- `User.staffingRequestsLastSeenAt` (nullable) is the read marker. The badge counts requests with
  an event newer than that timestamp, excluding events the viewer caused; opening the tab stamps it
  to now.
- Because the history write **is** the notification, it cannot fail silently the way a ticket
  history write can (a lost row there just costs a log line nobody reads closely). Staffing-request
  history writes are awaited and their errors surfaced, unlike the rest of `historyService`.
- `Notification` is untouched — no new optional fields, no leadership rendering surface.

**Rule for the next notification-shaped feature:** if the thing needing a badge already has (or
should have) an append-only history trail, and it doesn't naturally have both a ticket and a
workspace, drive the badge off that history log with a per-viewer last-seen timestamp — don't bend
`Notification` to fit. Reach for `Notification` only when the feature is genuinely ticket-shaped and
workspace-scoped and belongs in the sidebar bell.

**Tripwire:** if a third feature needs this same last-seen-against-history pattern, that's the
signal to extract it into a shared helper (a generic "unseen entities of type X since timestamp Y"
query plus a generic last-seen field) instead of a third bespoke copy.

## Consequences

- One append-only log (`History`) now serves both audit trail and notification for staffing
  requests, instead of two overlapping records of the same events.
- The leadership shell gains a badge with no bell component and no `Notification` involvement —
  consistent with it having no ticket/workspace context for anything else either.
- Adding a `staffingRequest`-scoped read to `History` needed a new index (`entityType, timestamp`)
  because the existing one is keyed per-entity (`entityType, entityId, timestamp`) and can't answer
  "which entities of this type have news," which the badge needs.
- Reversing this — moving staffing news onto `Notification` later — costs rebuilding the read
  marker as per-notification-row `read` state, adding a leadership bell surface, and retiring the
  `staffingRequest` history entity type once nothing but the audit trail still reads it.
