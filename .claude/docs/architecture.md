# Architecture

Shape of the system as it stands. Feature history lives in `.scratch/<feature>/issues/`; the
decisions behind the load-bearing choices live in `docs/adr/`; domain vocabulary lives in
`CONTEXT.md`. This file says how the pieces fit — when a rule's *reasoning* matters, it is a
comment at the code it constrains, and this file points there rather than restating it.

## Two domains

1. **Programme management** — interns, mentors, evaluations, mentor comments, readiness flags,
   recommendations, staffing requests, leadership dashboards.
2. **Ticketing / project work** — workspace-scoped tickets with custom statuses, priorities,
   story points, time-in-status, threaded comments + @mentions, change history, board + table
   views, archiving, CSV export.

## Platform roles

Defined in `server/constants/roles.js` (`ROLES` = `admin | mentor | intern | leadership`).
Roles are assigned at the **user** level and drive route landing + guards.

| Role | Lands on | Capability |
|---|---|---|
| Admin | `/dashboard` (admin dashboard) if they have an active workspace, else `/admin/workspaces` | Full access. Manages users, workspaces, reference data. **Bypasses workspace membership checks** for tickets/rooms. |
| Mentor | `/my-interns` | Guides assigned interns via mentor notes and documentation links only. Evaluations, readiness, recommendations, the attendance roster, the internal CV link, and lifecycle status changes are admin-only — see `.claude/docs/security.md` ("Intern access"). Works in workspaces on tickets. Can create workspaces (becomes owner) and manage/delete the ones they own or workspace-admin — no global workspace list. |
| Leadership | `/programme` | Read-oriented stakeholder view, plus the one leadership write path (staffing requests). No ticket/workspace workflow — redirected to `/programme`. |
| Intern | `/dashboard` or `/create-workspace` | Manages own profile; works on assigned tickets in their workspace. Reads — read-only, self only — their own evaluations (notes included), readiness and recommendations on `/my-progress`. |

**Two authorization layers** — do not conflate:
- **Platform role** (above) — `admin/mentor/intern/leadership`.
- **Workspace membership role** — `admin` / `member` — controls per-workspace management actions,
  independent of platform role. See `.claude/docs/security.md`.

## Data model (Mongoose, `server/models/`)

Core: `User`, `Workspace`, `Ticket`, `TicketStatus`, `Category`, `Comment`, `History`,
`Notification`, `RefreshToken`, `Integration`, `Daily`, `Sprint`.
Programme: `InternProfile`, `Evaluation`, `MentorComment`, `ReadinessFlag`, `Recommendation`,
`Attendance`, `NonWorkingDay`, `Position`, `Project`, `Hub`, `Technology`, `InternshipType`,
`Invitation`, `StaffingRequest`.
AI: `AISummary`.

- Tickets, statuses, categories, comments all carry a `workspace` ref — the scoping anchor.
- `User.preferences` — one optional subdocument (`_id: false`) holding the UI preferences that
  follow the account. Every field is optional and **absent means "never chosen"**, which is what
  the sync layer keys off; see "UI preferences" below.
- `User.avatarUrl` / `User.avatarPath` — the profile picture; see "Profile pictures" below. Two
  fields on purpose, and `avatarPath` is `select: false`.
- Statuses are **per-workspace and customizable** (not a global enum). See `statusService` and
  `server/helpers/statusValidation.js` / `statusSlugAliases.js`.
- **A status's `slug` is its identity, and a rename must never change it.** `updateStatus` writes
  the label only; everything that refers to a status across time refers to it by slug. A caller
  that genuinely wants a new key passes `updates.slug`, which goes through the duplicate check and
  integration sync (`applyStatusSlugChange`). The consumers this protects, and the silent breakage
  regenerating the slug caused, are listed at `statusService.js#updateStatus`.
- **`Ticket.blockedBy`** — `{ ticket, note }`, why a ticket can't move while it is Blocked. Both
  halves optional and independent; only meaningful in the Blocked status, and cleared on the way
  out of it. See "Ticket blockers" below.
- **`Ticket.reviewRequest`** — at most one live ask for a mentor to look at the ticket's work, or
  `null`. See "Review requests" below.
- `User.preferences` — one optional subdocument holding the account's UI preferences (mode,
  accent, density, contrast, colour-vision, motion, landing page, tickets view, default assignee,
  board sort, muted notification groups). Its keys and legal values are declared once in
  `server/constants/userPreferences.js`, which the schema and the service both build from.
  Every field is optional: absent means "never chosen", and the read merges the defaults in.
  Read/written by their owner only, at `GET|PATCH /api/users/me/preferences` — the PATCH is a
  dot-notation partial merge, last-write-wins. **UI scale is deliberately not in it** and stays
  per-device in the browser. See "UI preferences" below.
- `User.whatsNewSeenVersion` — the `TOUR_VERSION` of the what's-new tour this account has
  finished, or `null` for "never seen one". A top-level field rather than a `preferences` row
  because `preferences` validates every write against an enum table and a release string has no
  such list; it is the same shape as `staffingRequestsLastSeenAt` — a marker the app writes, not a
  setting the user picks. Written by its owner only, at `PATCH /api/users/me/whats-new-seen`. See
  "The what's-new tour" below.
- `User.isTestAccount` — marks an internal QA login (seeded by `seedTestAccounts.js`, safe on
  production) that must work exactly like a real account but is excluded, at the query, from
  every listing that surfaces mentors/leadership. See `.claude/docs/security.md` § Test accounts.
- `User.isTombstone` — marks the single "Deleted user" placeholder that refs left behind by a
  hand-deleted User point at (`migrate:tombstone-user-refs`). Cannot log in, and excluded from
  every listing of users with no bypass. Its existence changes one rule: a ref to a deleted
  account no longer populates as `null`, so a guard asserting "a real person is here" must call
  `isRealUser` (`constants/userVisibility.js`) rather than checking truthiness. See
  `.claude/docs/security.md` § The deleted-user tombstone.
- `Daily` — one standup record per `(workspace, date)` (unique compound index), with embedded
  `entries` (one per reporting intern: `done`/`todo` text lists + `blockers`, each blocker an
  optional `linkedTicket` ref scoped to the same workspace). Pure edit-window/derived-count logic
  lives in `server/helpers/dailyRules.js`. An admin-only cross-workspace reporting overview
  (`getWorkspaceDailyOverview`/`getMemberDailyEntry` in `dailyService.js`, routed at
  `/api/dailies/admin/*`) derives a calendar-month reporting-coverage grid and per-member entry
  detail from the same documents — no new schema. See ADR-0001.
- `Sprint` — workspace-scoped: `name`, `start`, `end`, an optional `goal`. Nothing else is stored
  — no lifecycle field, no ticket list, no cached counts. State (`upcoming` / `active` / `past`) is
  derived from the dates against "today" rather than stored, and no two sprints in a workspace may
  overlap (containment and shared endpoints count as overlap). Both rules live in the pure, clock-
  free `server/helpers/sprintRules.js`. Ticket-to-sprint membership is a later ticket's addition —
  this collection alone does not yet hold or reference any ticket. See ADR-0009, ADR-0010, ADR-0011
  and `CONTEXT.md`'s Sprints section.

## Ticket blockers

Why a ticket can't move, recorded on the ticket itself while it sits in the **Blocked** status.
`Ticket.blockedBy` = `{ ticket, note }`; rules in `server/helpers/ticketBlocker.js` (pure,
unit-tested), carried out by `ticketService`. Frontend: `helpers/ticketBlocker.js` (a deliberate
mirror of the same slug and note cap, since the two are separate packages) over
`components/Tickets/{BlockedByField,BlockingTicketPicker}.jsx`.

- **Two optional, independent halves.** `ticket` is another ticket in the same workspace; `note`
  (≤ 500 chars, plain text) covers the case where nothing on the board is the blocker — waiting on
  a client, a credential, an external release. Neither is required: "Blocked, reason not yet known"
  is a normal state and the field says so rather than demanding an answer.
- **"Blocked" is a slug, never a label.** Statuses are per-workspace and renameable, and a rename
  deliberately keeps the slug, so the field follows a workspace that renames Blocked to "Stuck" and
  disappears for one that deletes the status. `isBlockedStatusSlug` is the only test on both sides;
  nothing compares labels.
- **Leaving Blocked clears the blocker**, whether or not the client sent the field. A ticket that is
  In progress while still advertising "blocked by Ticket 12" is simply stating something false, and
  nobody goes back to tidy it up. The corollary: `blockedBy` is resolved against the status the
  ticket **ends up** in, not the one it had, so a move into Blocked can carry its blocker in the
  same request.
- **An absent `blockedBy` means "leave it alone", not "clear it"** (`parseBlockerInput` returns
  `undefined` vs `{ticketId: null, note: ''}`) — otherwise editing a title would wipe the blocker.
- **Refused at write time**: a ticket from another workspace (`resolveBlockingTicket`, see
  `.claude/docs/security.md`), itself, any link that would close a cycle (`assertNoBlockerCycle`
  walks the chain the candidate blocker waits on), and a blocker that is already **done**
  (`blockerIsDone`, read off the status's `isDone` behaviour flag — never its label, which a
  workspace may have renamed to "Shipped"). Two tickets each claiming the other blocks them is not
  something the database can catch and reads as a deadlock nobody put there; a finished ticket is
  simply not something anyone is waiting for.
- **The done rule applies to a *new* link only.** `resolveBlockingTicket` takes `previousBlockerId`
  and skips the check when the link is unchanged, so a blocker that gets finished *after* it was
  linked leaves a stale link rather than a wall in front of every other edit to the ticket — leaving
  Blocked is what clears it. The picker drops done tickets from its results
  (`isDoneBlockerCandidate`, the client mirror) — filtered client-side, because "done" is a
  per-workspace status flag rather than something `GET /tickets` can filter on, so a page of
  results can come back short. Link and note changes are logged to `History` separately, since
  they move independently.
- **Populated at two widths.** `BLOCKER_POPULATE` (single-ticket reads: create / update /
  `getTicketById`) carries the blocker's subject, number, archived flag and its own status, so the
  panel can show whether it is still in the way. `BLOCKER_LIST_POPULATE` — number and subject only —
  rides the list endpoints, where a `Blocked by #12` chip is all that renders. The
  priority-ordered list sorts in Mongo and gets the same shape from `blockerLookupStages()`, because
  `$lookup` knows nothing about Mongoose populate; keep the two in step or the chip vanishes as soon
  as a user sorts by priority.
- The frontend field mounts **only while Blocked is the selected status**, so its appearance is the
  whole explanation for why it appeared. Switching the status away keeps what was typed (a misclick
  shouldn't lose it) and the form filters it out on submit instead. The linked ticket renders as a
  clickable reference wherever the host page passes `onOpenTicket` — the detail modal swaps onto that
  ticket, confirming first if the current one has unsaved edits.
- **It carries no card of its own**, and takes the shape of the column it is dropped into:
  `variant="rail"` is the lead section of the details modal's `TicketMetaRail` (rail captions,
  controls on `bg-card`, a rule under it), `variant="form"` is plain `Field` rows in the create
  modal's aside. The danger tone is one icon on the caption — the status is already called Blocked
  and already wears the colour. The picker uses the shared `SearchField`, so it is the same search
  control as everywhere else.
- **`BlockedByChip`** is the list/board form of the same reference (`Blocked by #12`, next to the
  title in `ticketColumns` and in the meta row of a board card). Geometry and colour come from the
  shared chip vocabulary (`CHIP` + `chipTone('danger')` in `helpers/badgeTones.js`), so it matches
  the category and PR chips beside it and follows the colour-blind-safe palette. It renders as a
  `role="button"` span rather than a `<button>`, because the board card it sits on is itself a
  button. It opens the **blocking** ticket,
  so it stops the click reaching the row/card underneath — which opens the ticket it sits on — and
  stops `pointerdown` reaching the board's dnd-kit drag listeners. It renders nothing without a task
  number (`blockedByChipLabel`): a note-only blocker has no reference to offer, and the row already
  carries a Blocked badge.
- **History for a status change is written after the update commits, not when it is decided.**
  The blocker validation sits between the two and rejects routinely (cross-workspace, cycle), and an
  entry written earlier would have the log claiming a move the database never made.

## Review requests

An intern, on a ticket they are assigned to, asks one of their own mentors to look at a pull
request. Platform-only in this version — nothing is written to GitHub, no reviewer is requested on
the PR itself. See `CONTEXT.md` § "Code review", ADR-0007 (reviewer selection) and ADR-0008 (the
independent `prUrl`).

- **`Ticket.reviewRequest`** — `{ reviewer, state, prUrl, owner, repo, prNumber, requestedBy,
  requestedAt, answeredAt }`, at most one per ticket, cleared rather than accumulated (the same
  shape choice `blockedBy` made). `state` is `pending | approved | changes_requested`.
  `owner`/`repo`/`prNumber` are **derived**, written only by
  `server/helpers/reviewRequestRules.js#parsePullRequestUrl` — never accepted from a client, never
  reconciled with `Ticket.linkedPullRequest` (ADR-0008: two independent links to one PR, allowed to
  disagree). Indexed on `reviewer` + `state` — the pill row's active filter is one indexed query.
  The pill *counts* are not: the page reads the reviewer's requests once, unfiltered, and tallies
  the states client-side, same shape as the status-tab counts.
- **Rules live in `server/helpers/reviewRequestRules.js`** (pure, unit-tested): PR URL shape
  validation (`https://github.com/<owner>/<repo>/pull/<n>` only, missing vs malformed reported as
  distinct errors), reviewer-candidate resolution (`resolveReviewerCandidates` —
  `primaryMentor` always, `secondaryMentor` only once `specializationAssignedAt` is set, filtered
  to active members of the ticket's workspace via `workspaceAuthz.isActiveWorkspaceMember`),
  transition guards per actor (`assertCanRequestReview`/`assertReviewerEligible`/
  `assertCanAnswerReview`/`assertCanCancelReview`), the stale rule, mismatch detection, and
  `History` phrasing. `ticketService.js` calls into it and reimplements none of it. One export has
  no server call site on purpose: `detectPullRequestMismatch`, because the disagreement is shown and
  not enforced, and the showing happens in the frontend mirror — it lives here so a server-side need
  takes the rule from here rather than growing a second definition.
- **Dedicated routes**, unlike `blockedBy` (which rides inside the ticket `PATCH` because anyone
  who can edit the ticket can set it): `POST/PATCH/DELETE /api/tickets/:ticketId/review-request`
  and `GET /api/tickets/:ticketId/review-request/candidates`. `PATCH /api/tickets/:id` cannot
  touch `reviewRequest` — it is not in the controller's update whitelist, so a review verdict can
  never ride along inside an unrelated ticket edit. `GET /api/tickets?awaitingReviewFrom=me` backs
  the tickets list's review-request pill row (admin/mentor only — an intern is never a request's
  reviewer). `reviewRequestState` (`pending`/`approved`/`changes_requested`) narrows it to one
  state; omitted, it means "All requests" — any state, still scoped to that reviewer.
- **Requesting again replaces the request and resets it to `pending`**, from any prior state —
  this is the whole of "re-request"; there is no separate action. **Cancelling is `pending`-only**
  (`assertCanCancelReview`): an answered request is the record of who reviewed and when, so neither
  party may delete it, and requesting again is the only way off a verdict. **Goes stale** (the request is
  dropped, logged to `History`, no notification) when the ticket reaches a status whose `isDone`
  flag is set, or is archived — read off the flag, same rule `blockedBy` follows, never a status
  label a workspace may have renamed.
- **Deliberately no status movement of any kind**, independent of
  `Integration.settings.autoMoveOnPROpenEnabled`/`autoMoveOnMergeEnabled`. The whole flow works in
  a workspace with no GitHub integration connected.
- **Notifications**: `ticket_review_requested` (recipient: the reviewer, fires on every request
  including a repeat) and `ticket_review_completed` (recipient: the intern, body points at the PR
  since the verdict carries no words). A new **`reviews`** mute group ("Code reviews") in both
  `server/constants/userPreferences.js` and `frontend/src/helpers/notificationPreferences.js` —
  not folded into `assignments`, so muting "Assigned to me" cannot silently kill reviews. Cancelling
  or going stale notifies nobody.
- **Frontend**: `helpers/reviewRequest.js` mirrors the URL validation and adds chip label/tone per
  state (a deliberate duplicate of the server rule, same justification as the two `ticketBlocker`
  helpers). `components/Tickets/TicketReviewField.jsx` is the meta rail section (mounted beside the
  blocker field, in the modal's `lead` slot) — form for the requesting intern, answer controls for
  the named reviewer, read-only summary for everyone else in the workspace.
  `components/Tickets/TicketReviewChip.jsx` is the list/board chip, same chip vocabulary as
  `BlockedByChip`, sitting in the card's meta row (not beside the title, since a card can already
  carry a blocker chip and a PR chip there).

## Auth flow

- Login issues a short-lived **access token** (JWT) + a rotating **refresh token**.
- **Both tokens are stored in `localStorage`** (`accessToken`, `refreshToken`) — see
  `frontend/src/api/axios.js` and `src/context/AuthContext.jsx`. The access token is sent as
  `Authorization: Bearer <token>` via the axios request interceptor.
- Refresh: axios response interceptor catches 401, reads `refreshToken` from `localStorage`,
  calls the refresh endpoint, stores the new tokens, and retries queued requests
  (single-flight via `isRefreshing` + `failedQueue`). On refresh failure it clears both tokens.
- `server/middleware/auth.js` `protect` verifies the JWT, loads the user, and rejects if
  `decoded.tokenVersion !== user.tokenVersion` (logout-everywhere / rotation invalidation).
- Refresh tokens persisted (`RefreshToken` model); `tokenVersion` on `User` gates validity.
  Logic in `server/services/authService.js`.

## Profile pictures

One picture per account, for every role — admin, mentor, leadership and intern alike, because every
human on the platform is a `User` row (an intern is a `User` plus an `InternProfile`, not a separate
identity). An account without one renders initials, tinted by `getAvatarColor`, exactly as the whole
app did before this existed.

**Write path.** `POST /api/auth/me/avatar` (multipart, field `avatar`) and
`DELETE /api/auth/me/avatar`, in `services/userAvatarService.js`. Self-serve only: the account comes
from the token, never from the URL, the same shape `PATCH /auth/me/password` settled on. There is
deliberately **no admin-sets-another-user's-picture endpoint** — unlike a password, nobody is ever
locked out of a photo, so the admin-override that justifies `PATCH /auth/:id` for passwords has no
equivalent. `PATCH /auth/:id` builds its update from an explicit allow-list, so neither field can be
written through it.

**Two fields, not one.** `avatarUrl` holds the public URL and rides along in the ordinary user
projection; `avatarPath` holds the storage key, is `select: false`, and exists so replacing a picture
can delete the object it replaced. A Mongoose virtual would have been tidier but does not survive
`.lean()`, and roughly forty-six of the queries that populate a user are lean — the avatar would have
appeared on some screens and silently vanished on others. If `SUPABASE_URL` or the bucket ever
changes, the stored URLs go stale and `avatarPath` is what makes re-deriving them a one-line script.

**Read path — `server/constants/userSelect.js`.** `userSelect(...extras)` is the projection every
query returning *a person to look at* uses:

```js
populate('creator', userSelect())            // fullname email avatarUrl
populate('assignedTo', userSelect('role'))
{ path: 'user', select: userSelect('role', 'status', 'hub') }
```

Before it, ~60 sites each carried their own literal (`'fullname email role'` and a dozen variants).
Mongoose returns only what a projection names, so any site not updated would keep serving initials —
and a colleague with a photo on the board and a monogram in the ticket rail reads as a bug, not as a
missing field. The next field that has to appear beside a name is one edit there. Hand-built DTOs
that reshape a user (`formatUser`, `toInternSummary`, `internSummary`, the `$project` stages in
`ticketService`) name `avatarUrl` themselves — a projection constant cannot reach inside those.

One deliberate exception: the intern-facing view of a mentor note projects
`'fullname role avatarUrl'` by hand, because that view does not carry the author's email and
`userSelect()` includes it.

**Bucket.** `SUPABASE_PROFILE_BUCKET`, public-read, permitting `image/jpeg`, `image/png`,
`image/webp`. Required rather than defaulted to the workspace-logo bucket: that bucket caps objects
at 1MB and disallows WEBP, so valid uploads came back as 502s from storage. See `security.md` for
the public-read and no-SVG decisions.

## UI preferences (account-level)

Appearance, workspace-default and notification-mute preferences follow the **user**, not the
browser. `GET|PATCH /api/users/me/preferences` (`protect` only — the subject is always `req.user`,
so there is no id to guard). The PATCH is a **partial merge** written with dot-notation `$set`, so
two browsers changing two different preferences do not clobber each other.

- The enum table is `server/constants/userPreferences.js` — model, validation and endpoint all read
  it, and its frontend twin is the preference table in `src/context/ThemeConfigContext.jsx`
  (`DOM_PREFERENCES` + `VALUE_PREFERENCES`, joined into the exported `ACCOUNT_PREFERENCES`). A new
  preference costs a row in each; nothing else enumerates them.
- **Two halves to that table.** `USER_PREFERENCE_DEFINITIONS` holds the single-valued preferences
  (one enum, one default). `USER_LIST_PREFERENCE_DEFINITIONS` holds the list-valued ones — muted
  notification groups, and the quick-action order — each an enum for its *members*. Both halves are
  read by the model, `buildUpdate` and `DEFAULT_USER_PREFERENCES`, so a list preference costs a row
  rather than a branch. Every list is validated against its enum and de-duplicated, which is
  also what bounds its length: a list of unique members from a fixed enum cannot outgrow the enum.
- **A list preference stores keys, never a resolved list**, so a retired member is ignored on read
  and a renamed label costs nothing. What *absence* means is per preference: an unmuted notification
  group defaults to "on", while an action missing from a five-slot quick-action selection stays off
  the card — five picks were deliberate, and evicting one for a newcomer would be worse than not
  showing it.
- **Three states, not two, for the quick-action selection.** Key absent = never chosen (show the
  shipped default); stored `[]` = chose to have none; stored list = chose these. The client cache is
  one string, so the empty selection needs a sentinel (`'none'`): `readStoredPreference` reads an
  empty cached string as "nothing cached" and hands back the fallback, which would make removing the
  last action snap the default back and read as a bug.
- **`maxLength` on a list preference** bounds it more tightly than its enum does — the quick-action
  selection is capped at five because that is what the card has room for.
- **A preference sent as `null` is deleted, not written.** `buildUnset` turns it into a `$unset`,
  and the PATCH carries `$set` and `$unset` together. Reset therefore means "as shipped" rather
  than "pinned to today's default" — the same reasoning as `AbsenceRequestSettings`, which stores
  only differences. On the client, the quick-actions row maps the empty cached string to `null` for
  exactly this.
- **Not every preference is account-level.** `PREFERENCE_SCOPE.DEVICE` marks the rows that stay in
  the browser: UI scale (a function of screen size, not taste), the desktop-notification switch
  (`notify-desktop` — browser notification permission is granted per browser per device, so a
  synced switch would read "on" where nothing could ever draw), and the collapsed sidebar sections
  (`nav-sections-closed` — same reasoning as UI scale: you collapse Admin because ten rows do not
  fit a laptop, and syncing it would carry that compromise onto a desktop). Both tables are filtered
  to `ACCOUNT` when `ACCOUNT_PREFERENCES` is built, so a device row is declared like any other and
  simply never pushed. Scope is what excludes it, not omission from the table.
  A device row still gets a table row, because the table is where a preference is *declared*
  whether or not the sync layer carries it — but it needs **no server change at all**: no
  `userPreferences.js` row, no `User` subdocument, no `buildUpdate` branch.
- Both responses carry `{ preferences, storedKeys }`. `storedKeys` names the
  preferences this account has actually saved; **the client reconciles per key**, so a value only
  set locally survives while the saved ones take the server's answer.
- **`localStorage` is a write-through cache; `User.preferences` is the source of truth.** The cache
  exists because the attributes on `<html>` are applied *before the first paint* — the pre-paint
  IIFE in `frontend/src/main.jsx` plus the mount effect in `ThemeConfigProvider` — and a server
  round trip cannot beat that. Break this and every page load flashes the default theme. Writes go
  through `hooks/useStoredPreference.js` → `lib/preferenceSync.js`, are debounced into one PATCH by
  `components/UserPreferencesSync.jsx`, and are flushed on `pagehide` with a `keepalive` request.
- `components/UserPreferencesSync.jsx` is the bridge: it sits inside `AuthProvider` (which
  `ThemeConfigProvider` is mounted above, so the first paint does not wait on React Query), installs
  the pusher, batches writes into one PATCH, hydrates from the record, and reverts the palette on
  sign-out. **Signed out, no pusher is installed and the query is disabled** — the auth screens
  never fire a preferences call, and render the default palette regardless of `localStorage`.
- `src/lib/preferenceCacheOwner.js` stamps who the cache belongs to — sign-out keeps the cache (so
  the return is flash-free), so the one-time migration off browser-only preferences must not adopt
  a stranger's values on a shared browser. When an account's record is still empty, that migration
  adopts whatever the browser already had cached and saves it as the account's first set
  (`hasStoredPreferences` on the GET) — moving to account-level preferences does not reset anyone.
- **UI scale stays per-device** and is deliberately absent from the server table — it is a function
  of screen size, not of taste. Signed out, the account-scoped attributes fall back to the house
  defaults so the auth screens never wear the last user's accent or accessibility settings.

## Sidebar navigation (`frontend/src/components/AppSidebar.jsx`)

One component builds the whole rail: role-filtered row arrays, a `sections` list that drops the
empty ones, and three presentations of the same tree. `helpers/navSections.js` holds the pure part
(the stored list, the open-set resolution and the signal rollup) and is unit-tested there.
`components/nav/SectionIcons.jsx` holds the filled section marks.

- **Two shapes, chosen in Settings → Appearance.** `navStyle` (`labelled` | `collapsible`, default
  **`labelled`**) decides whether each group stays the plain captioned list or gets a header that
  opens and closes. `labelled` is the pre-collapse sidebar and is kept **byte-for-byte** — 34px
  rounded rows, the 3px inset active bar, `bg-primary/20`, no section marks. Someone who turns
  collapsing off is asking for the old sidebar back; the divergence between the two branches in
  `NavItem` is the feature, not duplication to be tidied away.
- **The sidebar's two pieces of state are deliberately different scopes.** `navStyle` is taste, so it
  follows the **account** (a row in `USER_PREFERENCE_DEFINITIONS` and in `VALUE_PREFERENCES`).
  *Which* group is open is a function of screen height, so `nav-sections-closed` stays **per-device**
  and never reaches the server. Switching to `labelled` does not clear it.
- **Collapsible sections** are built on `@radix-ui/react-accordion` primitives directly — not on
  `components/ui/accordion.jsx`, which is the settings pages' wrapper and must not be restyled for a
  nav row. The accordion is **controlled**: its value is derived every render from the stored list,
  the active route, the rail and the tour, and each interaction is read back as a diff so a section
  opened *for* the person is never written back as a choice.
- **One section open at a time.** Opening Boards collapses Workspace (`singleOpen` in
  `resolveOpenSections`). The Root stays `type="multiple"` regardless, because the rail and the tour
  need *every* section open at once and `type="single"` cannot express that state. `singleOpen` is
  applied last, on top of the closed list, for the same reason — a store that could hold only one
  open key could not describe the all-open case at all.
- **The header is two controls.** The label navigates to the section's *first visible row*
  (Workspace → Dashboard, Boards → Tickets) and opens the section; the chevron only toggles. One
  control cannot do both — "click to open the group" and "click to collapse it" would be the same
  gesture on the same pixel. The destination is derived from the rows, so reordering them moves it.
- **What is stored is the closed list**, so a section added in a later release is absent from every
  stored list and therefore open — no migration. It is read in a `useState` initialiser, not through
  `useStoredPreference`: that hook reads storage in an effect, so the first paint would show every
  section open and the closed ones would animate shut on every page load.
- **A collapsed section peeks on hover** — its rows appear in a flyout to the right, which is what
  makes single-open cheap. **There is exactly one flyout for the whole sidebar**, rendered by
  `AppSidebar` into a portal and positioned from the hovered element's own rect. It began as a
  `Popover` per section and that design is unfixable by timing: every move along the rail was an
  unmount racing a mount, so a fast sweep showed the previous section's rows or an empty panel.
  Verified with real pointer moves. A portal is also required outright — the rail sets
  `overflow-hidden`, so anything drawn inside it is clipped at 34px.
- **The icon rail is one mark per section, not every row.** Hovering or focusing a mark opens the
  flyout; clicking it goes to the section's first row. This is the one place the nav hides rows, so
  three things are load-bearing: the mark is a link (the common case stays one click), the signals
  roll up onto it, and the flyout opens on **focus** as well as hover so the rows are not mouse-only.
  `labelled` keeps the old rail (every row, flat). The mobile sheet is the full sidebar.
- **A closed section must not swallow a signal.** The pending dot and the count badges roll up onto
  the header or the rail mark, and its accessible name names them ("Admin — 1 time-away request"); a
  dot alone says nothing about what is waiting, and a closed section is exactly where nobody can go
  and look. The section holding the active route is forced open for the same reason.
- **The tour forces every section open** while it runs. Five of its six nav steps point inside Admin
  and `whatsNewSteps.js` never drops a step for a missing target — a closed section would silently
  turn those into centred cards explaining features while pointing at nothing.
- **The active section is a band**, not a highlighted row: a neutral `bg-foreground/5` rectangle
  across the whole group, square and hugging its rows exactly, with the active row's own fill inside
  it. Neutral rather than accent-tinted because an accent wash behind an accent-tinted row left the
  row unfindable inside its own section. Nothing in the collapsible nav is rounded or gapped — rows
  and headers run edge to edge of the sidebar and stack flush, because any gap showed as a stripe of
  bare sidebar cutting through the band.
- Reduced motion needs no work here: `:root[data-motion='reduced'] *` in `index.css` kills every
  animation and transition with `!important`, the section reveal included.
- The section reveal has its **own** keyframes (`nav-section-up` / `-down` in `tailwind.config.js`),
  separate from the settings accordion's `accordion-*`: longer travel, `easeInOutCubic` matching the
  rail's own easing, and an opacity fade. Radix suppresses the animation on mount, so a page load
  does not unfurl the nav.
- The section marks are the **logo's four colours under Symphony Indigo and the account's accent
  under every other palette** — the same deal `[data-brand-mark]` strikes for the logo itself, so
  the marks are not the one thing in the rail still wearing the house brand while the rest of the
  chrome wears the user's accent. Nine `--nav-mark-*` tokens in `index.css` carry it: the house
  values sit in the base block, and one rule
  (`[data-theme]:not([data-theme='default'])`, plus `data-colorblind` when it is not `off`)
  repaints all nine from `--sidebar-primary` — `--sidebar-primary` and not `--primary` because
  several palettes set the two differently and these are drawn on the sidebar.
  Tokens are named for the **job** each colour does in the drawing, not its house hue, because
  four hues collapse to two values when the accent takes over (`lead`/`warm` full, `second`/`hot`
  at 58% over the sidebar's ground). That loss is the flooded brand mark's loss too — shapes told
  apart only by hue merge — and it is priced in per drawing: no mark puts two 58% shapes against
  each other. The upside is that `data-colorblind` now reaches them, which the fixed hexes could
  never do. They stay decorative either way: every section has its label beside the mark and
  status comes from the tone tokens, so do not encode meaning in which shape gets `lead`.

## The what's-new tour

A full-screen walkthrough that announces a release by spotlighting the controls that changed. It
lives entirely in `frontend/src/components/onboarding/` — `whatsNewSteps.js` is the script plus
every read and write of the seen-state, `WhatsNewTour.jsx` is the overlay, and `WhatsNewButton.jsx`
is the pulsing way back in from the sidebar footer.

- **Versioned, not boolean, everywhere — server included.** Shipping a release through it is two
  steps: edit the steps, then bump `TOUR_VERSION`. The bump is what re-announces to everyone
  exactly once. The server deliberately holds **no copy** of that constant (it validates only that
  the version is a plausible string), because a mirrored constant would make it three steps and a
  forgotten bump would reject every save.
- **`User.whatsNewSeenVersion` is the source of truth; `localStorage` is the backstop.** The
  account field is what makes reading the tour in one browser mean not meeting it in another. It
  arrives on the `GET /api/auth/me` payload — `getMe` spreads the whole user document — so it costs
  no extra request and needs no hydration gate: the tour was already gated on having a user. The
  per-account local key (`whatsNewTour:<userId>`) is written first and synchronously, and is what
  keeps a failed or offline PATCH from turning into a tour that reopens on every load. **Where the
  two disagree, seen wins.**
- `TOUR_ENABLED` in `whatsNewSteps.js` is the master switch and is a plain constant on purpose —
  flipping it is how you get an automated run past the scrim, the alternative being to drive as an
  account already marked seen. It gates both ways in, so `false` means the overlay cannot mount and
  the button renders nothing.

## Real-time (Socket.IO, `server/socket/`)

- `socketServer.js` — server setup, authenticated handshake (same JWT + tokenVersion check),
  per-event rate limiting, room-level authorization.
- `events.js` — event names + emit helpers.
- `invalidationScopes.js` — room key builders that drive React Query cache invalidation:
  - `user:<id>`, `workspace:<id>`, `workspace-tickets:<id>`, `ticket:<id>`,
    `workspace-dailies:<id>`, `intern:all`, `staffing-news:all`.
  - `intern:all` and `staffing-news:all` are global (not workspace-scoped) — broadcast to every
    connected client via `broadcastToAll`, since there's no room to target.
- Frontend consumes via `src/context/SocketContext.jsx`, invalidating query keys on events.

## Integrations

- **Groq AI** (`server/services/groqAiClient.js` + `aiSummaryService`, `ticketDescriptionGenerationService`,
  `ticketMetadataSuggestionService`, `internCvSummaryService`; prompts in `server/prompts/`).
  Optional — gated on env vars.
  - **Intern CV summary** — `GET|POST /api/interns/:userId/cv-summary`, admin/mentor only via
    `assertInternAccess`. The POST downloads the intern's uploaded CV from Supabase, runs
    `helpers/pdfText.js` over it and prompts Groq; the GET only reads the cache. Cached on
    `InternProfile` as `cvSummary` / `cvSummaryFor` / `cvSummaryAt`, where **`cvSummaryFor` is the
    `cvPath` the summary was generated from** — that is the whole staleness mechanism, so a
    re-upload is recognised rather than silently re-labelled. Deleting a CV clears all three.
    The prompt is deliberately descriptive, never evaluative — see the header of
    `prompts/internCvPrompts.js` before changing it.
- **GitHub App** (`server/services/githubService.js`, `autoLinkService.js`) — webhook-driven PR
  linking. RS256 JWT; installation tokens encrypted at rest (`server/helpers/crypto.js`).
- **Supabase Storage** (`server/config/supabase.js`) — attachment images, workspace logos, intern
  CVs, profile pictures. Server throws on startup if Supabase env vars missing, `SUPABASE_PROFILE_BUCKET`
  included — see "Profile pictures" for why that one is required rather than defaulted.

### CV technology auto-detection

Uploading a CV (`POST /interns/me/cv`) extracts the PDF text (`pdf-parse`, `helpers/pdfText.js`),
matches it against the canonical `Technology` catalog (deterministic keyword/alias matching,
`helpers/cvTechnologyMatcher.js`), and merges the hits into `InternProfile.selfTechnologies` — same
effect as a manual add, no `ReadinessFlag` created, so each reads "Not assessed" until a mentor
assesses it. Best-effort by design: an unreadable PDF adds nothing and never fails the upload.
See `services/internCvService.js#syncTechnologiesFromCv`.

- **A scan only ever adds — it never removes, and a re-upload accumulates.** A CV that omits a
  section, spells a skill differently, matches nothing, or cannot be read is not evidence the
  intern lost anything, so nothing already declared is touched. The merge is pure —
  `helpers/cvTechnologySync.js#mergeCvTechnologies`, covered by `cvTechnologySync.test.js` — and
  reports only genuine additions, so a technology that was already on the list is not announced
  as newly added. It follows that:
  - **No CV-vs-manual provenance is recorded.** `selfTechnologies` is one list from two sources;
    nothing needs to tell them apart, because neither can shorten it.
  - **`updateSelfTechnologies` is the only path that removes** — the intern's own act, on the
    technologies screen. A later CV that still mentions the technology adds it back as a fresh
    add; that is the accepted cost of scans never removing.
- **The catalog is the ceiling.** A skill with no `Technology` row is invisible to the scan however
  it is spelled, so a thin catalog reads as a broken scanner. Adding one takes three steps in the
  same change: `seeder/defaultTechnologies.js` (the entry), `helpers/cvTechnologyMatcher.js`
  (`TECHNOLOGY_ALIASES` — real-world spellings; version-suffixed forms like `html5`/`python3` need
  their own alias), and `npm run seed:technologies` to backfill existing databases.
  `cvTechnologyMatcher.test.js` fails if a seeded slug has no alias entry.

## Notifications

`Notification` (`server/models/Notification.js`) covers two domains on one model: ticketing
(`ticket_comment`/`ticket_assigned`/`ticket_mention`/`ticket_review_requested`/
`ticket_review_completed` — `ticket`/`workspace` populated, `link` empty) and the intern-programme
domain (`recommendation_created`, `recommendation_status_changed`,
`recommendation_not_placed`, `intern_placed`, `evaluation_created`, `readiness_updated`, the four
`specialization_*` types, `intern_status_changed`, `intern_expected_end_date_changed`,
`intern_documentation_updated`, `daily_attendance_reminder`, `intern_mentor_note_shared`,
`absence_request_decided`,
`mentor_note_mention`, `intern_request_from_leadership`, `absence_request_pending` — `internProfile` set when the event is
about one specific intern (null for a project-level staffing request), `ticket`/`workspace` null,
`link` a frontend route the bell's action button navigates to). Both domains push through the same
`sendToUser(..., 'new_notification', ...)` socket event and the same `user:<id>` invalidation
scope (`socket/invalidationScopes.js`) — no new scope key was needed for the intern domain. The
bell (`NavbarNotifications`) is mounted in both top-level shells — `SidebarLayout.jsx` (admin/
mentor/intern) and `SymphonyNav.jsx` (leadership, a separate layout) — so every role that can
receive a notification has somewhere to read it.

The same socket event optionally also draws an **OS desktop banner** — the browser's Notification
API, no service worker and no push subscription, so it needs the tab open. `SocketContext`'s
`new_notification` handler calls `maybeShowDesktopNotification`
(`frontend/src/helpers/desktopNotifications.js`), which reads every gate at call time rather than
from React state (a socket handler would otherwise hold whatever was true when it connected):
the reader's switch, browser permission, the mute groups, and whether the app is in the
background — `visibilityState` **or** `hasFocus()`, since a tab stays `visible` with the whole
browser behind another app. It is best-effort throughout: a failure never costs the cache
invalidation beside it, and the bell entry is the real record. The switch itself is per-device,
see "UI preferences" below.

Two deliberate exceptions, both only for `daily_attendance_reminder` (`FOREGROUND_TYPES` in
`desktopNotifications.js`), because that nudge is time-boxed — the check-in window shuts at 11:00,
so it has to interrupt rather than wait to be noticed:

- It **skips the background gate**, so the banner draws over the app the reader is looking at.
  The switch, the permission and the mutes all still apply.
- When the banner cannot draw because the device switch is off or permission was never granted —
  the common case, since the switch defaults to off and permission is per browser per device —
  `maybeShowDesktopNotification` calls back through `onBlocked` and `SocketContext` raises an
  in-app `sonner` toast instead. A **muted** group never reaches the fallback: mute means silence
  everywhere.

- **Ticketing** notifications live in `server/services/notificationService.js`
  (`notifyNewTicketComment`, `notifyTicketAssigned`, `notifyTicketMention`,
  `notifyTicketReviewRequested`, `notifyTicketReviewCompleted`), `await`ed from
  `commentService.js` / `ticketService.js` inside a try/catch that only logs on failure.
- **Intern-programme** notifications live in `server/services/internNotificationService.js`, one
  function per event (see `.claude/docs/security.md` for the writes that must never notify, or
  must notify staff instead of the intern). Every exported function computes a deterministic
  title/body first, then attempts a best-effort Groq rewrite for warmer phrasing — a JSON
  `{"title","body"}` contract parsed via `groqAiClient.extractJsonObject` — the same contract style
  as `ticketPrompts.js`'s JSON-returning prompts. Any AI failure at all — unconfigured key,
  timeout, malformed output — silently falls back to the deterministic text; a notification is
  always created either way, since this must never be the thing that makes an admin/mentor/
  leadership action fail or wait.
- **Two recipient axes, two prompt builders** (`server/prompts/internNotificationPrompts.js`).
  Most events notify **the intern** about their own record — `buildProgrammeUpdatePrompt`, with a
  distinctly celebratory `buildPlacementCelebrationPrompt` for `intern_placed`. A couple notify
  **staff** (admin/mentor/leadership) about someone else's situation — `mentor_note_mention`,
  `intern_request_from_leadership`, `absence_request_pending` — which use `buildStaffUpdatePrompt` instead: reusing the
  intern-framed prompt for a staff recipient produced text like "your programme record was
  updated" for a recipient reading about someone *else's* record, which is actively confusing.
  Always match the builder to the recipient axis when adding a new event type.
- **Called fire-and-forget** (no `await`) from the mutation services that trigger them
  (`recommendationService.js`, `evaluationService.js`, `readinessFlagService.js`,
  `specializationService.js`, `internService.js`, `mentorCommentService.js`, `projectService.js`,
  and the scheduled `dailyReminderService.js`) — mirrors the existing non-awaited
  `historyService.logEvent(...)` call in `commentService.js`. Every exported function catches its
  own errors internally and never rejects, which is what makes the bare, unawaited call safe — an
  unhandled rejection from a non-awaited async call is a process-level risk, so the safety net has
  to live inside the module rather than at each call site.
- **Placement dedup is structural, not a runtime lock.** `intern_placed` can be triggered from two
  independent admin actions — a recommendation's outcome flipping to `placed`
  (`recommendationService.js#updateRecommendation`) or a direct lifecycle status write
  (`internService.js#updateInternProgramme`) — and each guards on its own "did the profile just
  transition into placed" snapshot taken before the write, so it fires at most once per real
  transition and never on a no-op re-save (e.g. nudging an already-placed recommendation's start
  date). The two paths can't both fire for the same request.
- **Daily reminder** (`server/services/dailyReminderService.js`): a 10:30–11:00 Europe/Sarajevo,
  weekday-only nudge — "check in" and/or "file today's standup" — for whichever of the two an
  intern hasn't done yet; nothing fires for one who's done both. Polled every 5 minutes via
  `setInterval` (started from `index.js` after `connectDB()`), gated by an in-memory
  `lastRunDateKey` so the check body runs once per office day.

  The sweep only reaches interns who were signed in at that moment, so it has a second entry
  point: `runDailyReminderCheckForUser` re-runs the same check for **one** intern, behind
  `POST /api/notifications/daily-reminder-check`. The client half is `DailyReminderSync`
  (mounted at app level in `App.jsx`, inside `SocketProvider`), which posts on mount, on the tab
  becoming visible, and on a one-minute tick, once per day per device (`daily-reminder-checked` in
  `localStorage`). So an intern who opens any page at 10:47 is nudged then instead of missing the
  sweep. `Notification.dedupeKey` (`daily-reminder:<dateKey>:<userId>`) keeps the two entry points
  from writing two rows.

  The dedupe key alone would have made the on-arrival path a no-op, though, because the sweep
  writes a row for **every** due intern at 10:30 whether they are signed in or not — so by the
  time anyone arrives, the key is always spent. What that intern actually missed is not the record
  but the **delivery**: the `new_notification` socket event fired while they were offline. So
  `dispatch` takes `redeliverOnDuplicate` (set only by the on-arrival path, never by the sweep):
  on a duplicate it loads the existing row and re-emits it with `unreadDelta: 0`, since the badge
  already counts it. A row the reader has already **read** is not re-emitted — that is
  `{ skipped: 'already-read' }`, and it is what stops the nudge from following someone who dealt
  with it. No new dependency — reuses
  `attendanceTime.js`'s existing `Intl`-based, dependency-free timezone helpers (`officeHour`,
  `officeMinute`, `officeDateKey`, `isOfficeWeekend`) and skips `NonWorkingDay` entries. Attendance
  candidates mirror the roster `attendanceService.js#getRoster` already uses
  (`IN_PROGRAMME_STATUSES`, minus anyone exempt today); daily candidates mirror the roster
  `dailyService.js#getWorkspaceDailyOverview` already uses (`getActiveWorkspaceInterns`, per active
  workspace) — two different existing scoping rules, deliberately not unified into one.

## Recommendations (placement pipeline)

A recommendation is a mentor's placement proposal for an intern: a position + **project** (ref to
`Project`, admin-managed reference data — see below) + technologies, moving through a
**forward-only status lifecycle** with a separate placement outcome. Backend:
`server/{models/Recommendation.js, services/recommendationService.js,
controllers/recommendations.js, routes/recommendations.js}`. Frontend:
`components/interns/InternRecommendationsPanel.jsx` (data wiring + dialog state) over
`components/interns/recommendations/`.

**"In Selection"** is the user-facing name for the `recommended`/`interviewing` window (not yet
`resulted`) — used consistently across the leadership dashboard KPIs, Candidates filter and
Projects view. "Pipeline" survives only as the internal/doc term for the lifecycle as a whole
(this heading, `ACTIVE_PIPELINE_STATUSES`, `IN_PIPELINE_STAGE`); don't reintroduce it as UI copy.
See `CONTEXT.md`.

**Status lifecycle** — `recommended → interviewing → resulted`. Enforced server-side:

- A new recommendation always starts at `recommended` (create rejects anything else).
- `PATCH` rejects backward moves; the edit modal shows earlier stages locked. Setting a placement
  outcome forces status to `resulted`.
- **Interviewing can be skipped**: jumping `recommended → resulted` leaves interviewing dateless —
  rendered as a dashed "Skipped" step, distinct from "Pending" (not reached yet).

**Status dates** — `Recommendation.statusDates.{recommended,interviewing,resulted}` are the
authoritative, author-editable dates each stage was reached (each defaults to now when first
reached; may be backdated). Ordering is validated (`recommended ≤ interviewing ≤ resulted`) on the
server, on submit, and via date-picker `min`. The append-only `History` log (`entityType:
'recommendation'`, `statusKey`) remains the audit trail and the **fallback for records that predate
`statusDates`** — editing such a record seeds its dates from history first.

**Placement outcome** (`result.outcome`: `placed | not_placed`, note required) syncs the intern's
lifecycle status (`InternProfile.status`):

- `placed` → profile `placed`; `not_placed` → profile `ready` (back on the bench). Terminal states
  (`completed` / `discontinued`) are never touched.
- A recorded outcome can be changed but never removed.
- **`result.startDate`** (Date, optional) is the intern's **first day on the project** — often not
  the day the placement was decided. Prefilled with the Resulted date, editable afterwards in
  either direction; clearing it records "we don't know yet" rather than a guess. Deliberately
  **not** ordered against the stage dates: an intern may have started before anyone recorded the
  placement. It drives the attendance exemption (`InternProfile.placedAt`, see Attendance).
  Reversing the outcome clears it.
- **Delete recomputes from the most recent remaining recommendation**: newest is `placed` → stays
  `placed`, anything else (or none left) → `ready`. Deleting also removes the record's history
  trail; the confirm dialog warns when deleting the placement that marked the intern placed.
- **`result.demandEnded`** — set only by the staffing-request close-out cascade, never through this
  API. See `.claude/docs/staffing-requests.md`.

**Create guards** — the backend rejects create with 409 when the profile is
`placed`/`completed`/`discontinued`; the UI greys out **New recommendation** with a hover
explanation in those states. Concurrent open recommendations across projects remain allowed, but
creating a second while a `recommended`/`interviewing` one exists on a *different* project shows a
confirm dialog naming both projects.

**Roles** — admin-only for reads and writes (`assertReadAccess` /
`assertRecommendationWriteAccess`); `leadership` additionally has read access (fully read-only UI).
Mentors have no access at all, on the per-intern tab or the standalone `/recommendations` page.

## Staffing requests

Leadership records demand that arrived from outside the platform; admins answer it by putting interns
forward, which creates ordinary recommendations. The **only leadership write path** on the platform.

Its own doc: `.claude/docs/staffing-requests.md` — read it before touching staffing requests, the
put-forward flow, or the close-out cascade. The four load-bearing facts, so this file stands alone:

- **Not workspace-scoped** (`StaffingRequest`), the same exception as `Project`/`Recommendation`.
- **A staffing request holds no intern list.** Putting interns forward creates `Recommendation`
  records tagged with `staffingRequest`; who is on a project is always read off those
  (`docs/adr/0006`).
- **`closed` is terminal** — no reopen, no delete, no write of any kind to a closed request
  (`docs/adr/0005`). Closing resolves every candidate still in selection as `not_placed` with
  `result.demandEnded` (`docs/adr/0004`).
- **`helpers/staffingRequestRules.js` is the single authority** on what a user may do to a request.
  Services carry out its verdicts; screens never re-derive them.

Authorization lives in `.claude/docs/security.md`; vocabulary in `CONTEXT.md`.

## Specializations

An admin confirms **one of an intern's two declared positions** (`InternProfile.declaredPosition` /
`secondaryPosition`) as their focus, paired atomically with a dedicated 1-on-1 mentor. The mechanics
and the naming trap are in `CONTEXT.md` § "Specializations & positions" and
`docs/adr/0002-specialization-repurposes-secondary-mentor.md` — in short: marker is
`InternProfile.specializationAssignedAt` (set ⟹ `declaredPosition` IS the specialization, no
separate field), the mentor is the repurposed `InternProfile.secondaryMentor` (must differ from
`primaryMentor`), and confirming the secondary slot **swaps** the two positions.

Backend: `server/{helpers/specializationRules.js, services/specializationService.js,
controllers/specializations.js, routes/specializations.js}`. Not workspace-scoped — same
firm-global intern domain as Recommendations (see `.claude/docs/security.md`).

Two frontend entry points, both admin-only and both driving the dialogs in
`components/interns/specialization/`. `pages/SpecializationPage.jsx` is the management surface and
the only one with all four verbs. An intern's own profile
(`components/interns/InternSpecializationPanel.jsx`, its own card in the Overview tab's right rail,
above the programme controls) carries just
assign and change-mentor for the one intern on screen — the state it offers comes from
`getSpecializationAction` in `helpers/internProfile.js`, gated by `canManageSpecialization`, since
`InternProfileView` also serves mentors.

`specializationRules.js` is pure and holds every state transition (`applySpecialization`,
`reassignSpecialization`, `changeSpecializationMentor`, `clearSpecialization`,
`canInternEditDeclaredPosition`). The service loads, validates and persists. All routes admin-only:

| Route | Does |
|---|---|
| `POST /api/specializations` | Assign. Requires an existing `declaredPosition`; validates the mentor via `internProfileService#assertMentorUser` (active `admin`/`mentor`). |
| `GET /api/specializations` | The one filterable/paginated read backing the whole tab — `status` (`specialized` default \| `unspecialized` \| `all`), `mentorId`, `search`, `page`/`limit`. |
| `GET /api/specializations/candidates` | Every *un*specialized intern for the assign modal's picker, including ones with no declared position (shown disabled, not hidden). Only fetched when the modal opens *without* a target — opened from a profile it is handed the intern record instead, and skips this call. |
| `PATCH /:internUserId/reassign` | Correct to the intern's other position — swaps again; mentor and marker untouched. Throws if there is no secondary position. |
| `PATCH /:internUserId/mentor` | Re-pair with a different mentor; position and marker untouched. |
| `DELETE /:internUserId` | Clear. **No un-swap** — the position stays where the last assign/reassign left it. |

- `search` matches `User.fullname`/`email`, resolved to `user: { $in: ids }` before the profile query
  since `InternProfile` holds no searchable text itself. The list's `stats` (`specializedCount`,
  `totalCount`, plus `mentorLoad` when `mentorId` is set) are computed against the **whole** cohort
  independent of the active filters, so the header numbers stay stable while browsing views.
- Reassign / change-mentor / clear all load the profile first and 400 if `specializationAssignedAt`
  is not already set (`loadSpecializedProfile`) — nothing to manage on an unspecialized intern.
- **The lock**: while the marker is set the intern can't self-edit `declaredPosition`
  (`canInternEditDeclaredPosition`, enforced in `internService.js#updateSelfPosition`, 403). The
  secondary stays intern-editable and, via the existing "must differ from main" rule, automatically
  excludes whichever position the swap locked in.

### Project (reference entity)

`Project` (`server/models/Project.js`) is the canonical list of client engagements a recommendation
can point at (title, client, description, tech tags, `status`: `active | on_hold | completed`,
`type`: `client | internal`). Firm-global reference data, same pattern as `Technology`/`Position` —
**not** workspace-scoped despite the general "workspace-scope every resource" rule (that rule is the
ticketing domain's, not intern/recommendation reference data's).

- **Admin-only** create/edit (`requireRole(ROLES.ADMIN)`) — mentors can only select a project when
  writing a recommendation. Managed from the "Projects" tab on `/admin/platform-management`
  (`ReferenceDataProjectsPanel`).
- **`type`** is **required with no schema default**, so `projectService.createProject` rejects a
  missing or unknown value rather than letting a default absorb it. Purely descriptive today —
  it renders as a neutral badge and **nothing branches on it**. Stored slugs live in the model enum,
  display labels in `frontend/src/helpers/projects.js`, so relabelling never needs a migration; the
  value set is a provisional pair (see `CONTEXT.md`). Projects predating the field are typed by
  `npm run backfill:project-types` (idempotent) — run it right after deploying the schema change,
  since an unset `type` fails validation on any `save()`.
- Only `status: active` projects are offered in the recommendation form's picker; `on_hold` /
  `completed` stay on existing recommendations but drop out for new ones.
- `Recommendation.project` is optional. `null` **is** the stored meaning of "we don't know the
  project yet" — there is no separate boolean flag and no sentinel document. (A locked sentinel
  project, `slug: 'unspecified'`, existed briefly for this same purpose back when `project` was
  free text; `seeder/migrateRecommendationProjects.js` is the historical record of that, and
  `seeder/removeUnspecifiedProjectSentinel.js` repoints every recommendation still pointing at it
  to `null` and deletes it.) The `unspecified` slug is not reserved — a real project can be named
  "Unspecified".
- **A create must assert one of the two** — an explicit project id, or an explicit `null` for
  "unknown" — never omit the field (`helpers/recommendationProjectRules.js#assertProjectFieldAsserted`),
  so a dropped field or a stale client can't produce an indistinguishable, legitimate-looking
  "unknown". Every path that creates a recommendation (ad-hoc, and putting interns forward against
  a staffing request) goes through this. **Editing** is free while `recommended`/`interviewing`;
  once `resulted` the field is locked, with one exception — a project that was never known can
  still be filled in (`assertCanEditProject`). Clearing or swapping a known project once resulted
  is refused, because that silently changes recorded placement figures a roster already counted.
  Internal surfaces read a recommendation's project through one shared display helper,
  `frontend/src/helpers/recommendations.js#recommendationProjectLabel`, which renders "Not known
  yet" for a null project rather than an em dash.
- **"Which interns are on project X" is a derived read** (query `Recommendation` by `project`), not
  a stored roster — there is no members/roster field by design.
- **Leadership-facing Projects page** (`/projects`, `/projects/:id`) reads two additive,
  leadership+admin aggregates built the same derived-read way: `GET /api/projects/overview` returns
  every non-system project annotated with `placedCount`/`inSelectionCount` plus page-level KPIs, and
  `GET /api/projects/:id/overview` returns one project's `placed`/`selection`/`history` by grouping
  that project's `Recommendation` rows. No new schema. `GET /api/projects/:id` (any authenticated
  role) fills the gap the list route left. All three respond `{ success, message, data }`; the
  original three routes (list/create/update) keep their pre-existing raw-JSON shape untouched.
  The list page's "only projects with someone placed or in selection" default is a **client-side
  view filter** over the same payload — the endpoint and every KPI still cover every non-system
  project, so `kpis.totalProjects` keeps agreeing with `GET /api/projects`. KPI cards clear that
  filter when clicked, since their numbers count unstaffed projects too. Read-only for leadership.

## Attendance (office check-in)

Interns check in once per office day; admins get a read-only roster with a per-intern calendar
modal. Backend: `server/{models/Attendance.js, services/attendanceService.js,
controllers/attendance.js, routes/attendance.js}` + `helpers/{attendanceTime,attendanceStats}.js`.
Frontend: `pages/{MyAttendancePage,AttendanceOverviewPage}.jsx`, `components/attendance/*`,
`helpers/attendance.js`.

- The **intern profile's Attendance tab** (`components/interns/InternAttendancePanel.jsx`, between
  "Mentor notes" and "Analytics") is a second reader of the same admin endpoint the roster's
  calendar modal uses — `GET /attendance/:internProfileId` via `useInternAttendance`. It is
  rendered for **admins and mentors**: that one route is `requireRole(ADMIN, MENTOR)`, widened
  deliberately because a mentor is the primary reader of their intern's attendance. Everything
  else in the module is unchanged — the roster (`GET /attendance`) is still admin-only, and no
  write verb admits a mentor.

- **Sparse storage — one document per intern per acted-on day** (`Attendance`: `intern` →
  `InternProfile`, `date` as office-local `'YYYY-MM-DD'` string,
  `status: present | cancelled | remote | vacation | religious | sick`, `checkedInAt`, `hub`,
  `checkInIp`, `request`).
  Absent days are **not** stored — absence is the lack of a record, derived at read time. A unique
  `{ intern, date }` index makes double check-ins idempotent (concurrent inserts race safely) and
  keeps a day to a single row that check-in, cancel and request approval all flip between.
  **Numerators come from `Attendance.ATTENDED_STATUSES` (`present` + `remote`), never from
  `status === 'present'`** — the latter silently drops remote days out of every percentage.
  Vacation, religious and sick days are `EXEMPT_STATUSES`: they leave the denominator rather than
  counting as attended or missed.
- **Cancel unchecks the day, it does not lock it**: the record is flipped to `cancelled` (not
  deleted) and reads as absent, but `checkIn()` flips that same row back to `present` (re-stamping
  `checkedInAt`/`hub`/`checkInIp`) for as long as the check-in window is open — the window closing
  is the only thing that settles a day. A repeat check-in on an already-`present` day is a no-op
  that preserves the original `checkedInAt`. All of this is app-level in `attendanceService.js`;
  nothing schema-level constrains the `present`↔`cancelled` transitions.
- **Reporting is per calendar month, never cumulative** (no all-time rate). `presentDays` /
  `workingDays` (Mon–Fri) / `attendanceRate` are computed for one month at a time, clamped to
  `[max(monthStart, startDate), min(monthEnd, today, lastOwedDay)]` — so a mid-month joiner isn't
  penalised, the current month only counts elapsed days, and a placed intern stops accruing. Always
  computed from raw records, never stored, so they can't go stale (`computeMonthStats`, shared by the
  roster and the admin dashboard, unit-tested in `attendanceStats.test.js`).
- **The obligation ends when an intern goes onto a real project.** `InternProfile.placedAt` (Date,
  nullable) is their **first day on the project** and is **inclusive-from**: that day is already
  exempt, so the last owed day is `previousDayKey(placedAt)`. From `placedAt` on, days leave the
  denominator and render as `DAY_STATUS.EXEMPT`. That cell is **hue-free on purpose** — a colour
  here would have to be answered for in both colourblind palettes, for a state that means "no
  obligation". It separates from the weekend by weight instead: denser fill, full-strength text, a
  neutral inset ring no other not-owed status has, and the briefcase glyph. **A weekend is never
  EXEMPT** — `classifyDay` skips both placement rungs on Sat/Sun, because "On project" on a Saturday
  reads as a day the intern worked. `checkIn()` is refused (422) so the exemption isn't merely
  cosmetic.
  - It mirrors the placement's **`result.startDate`** and nothing else (`placementExemptionDate`) —
    **not** `statusDates.resulted` (when the decision was recorded) and **not** `result.decidedAt`
    (when someone got around to clicking it). An intern placed today who starts in ten days owes
    attendance for those ten days. Re-derived on every result update, so moving the start date moves
    the exemption in either direction.
  - **A placement with no start date yet exempts nothing** (`placedAt` stays null): placed on paper,
    still owes attendance. Cleared when an outcome flips back to `not_placed`.
  - **Every path back onto the programme must clear it**, or the intern silently stays off
    attendance for good — 0 present of 0 owed forever, check-in refused (422), absence requests
    refused, no daily reminder. Four paths reset it: a `not_placed` outcome; deleting the placing
    recommendation (recomputed from the newest remaining record); the close-out cascade
    (`returnInternsToBench`); and an admin moving the lifecycle status out of `placed` by hand into
    `active` or `ready` (`internService.updateInternProgramme`). Moving to `completed` or
    `discontinued` **keeps** it — those interns are not coming back to owe anything.
  - **Clear it only via `closePlacementExemption`, never by assigning null.** `placedAt` is one
    *open-ended* boundary, so clearing it does not reopen the placed stretch — it reopens every day
    from the placement to today, and those days hold no attendance rows, because absence is stored
    as the **lack** of a row. A bare `placedAt = null` therefore hands a returning intern a wall of
    fabricated absence. `closePlacementExemption` records the stretch first (see below), then
    clears. It is idempotent, and records nothing for a placement whose start date never arrived.
- **`InternProfile.placementExemptions`** is the closed half of the same fact: placements the intern
  has already **returned from**, as half-open ranges `[{from, to}]` — `from` is the `placedAt` they
  were exempt from (inclusive), `to` is the day they rejoined and owed attendance again (exclusive).
  A list, because an intern can be placed, come back, and be placed again.
  - Those days leave the denominator exactly the way approved leave and a cohort-wide
    `NonWorkingDay` do: nothing owed, nothing missed. `placementExemptKeys` expands them and
    **`computeMonthStats` is the only thing that may act on them** — it takes them as its 7th
    argument, so callers pass the field and nothing has to remember how to merge it.
  - **`isExemptOn` / `isExemptToday` deliberately ignore them.** Those answer "may this intern check
    in, must they be reminded", which is about the placement they are on *now* — `placedAt`. A
    finished placement has no bearing on it.
  - A second `placedAt`-style date field cannot express this. Clamping the range *start* to the
    return date would erase every month before the placement, which had real obligation and real
    check-ins. The exemption is a range; only a range stores it.
  - Sent to the client on all three attendance payloads and expanded there by
    `placementExemptKeySet`, so the calendar classifies those days `DAY_STATUS.EXEMPT` instead of
    drawing a finished placement as absences. The two expansions must agree, or the cells contradict
    the percentage printed above them — including the weekend rule: **both sides leave Sat/Sun out
    of the set.** It changes no denominator (`countWorkingDays` never counted one), but a weekend in
    the set renders as "On project".
  - An intern with no recommendation at all is exempted by setting `placedAt` directly via
    `internService.updateInternProfile` — but for anyone who *has* a placement record that value is
    overwritten on the next update, so edit the start date instead.
  - **Distinct from `expectedEndDate`**, which is when the internship is expected to finish and
    drives placement-bench urgency. Do not conflate them.
- **`placedAt` is routinely in the future** now that a start date can be recorded ahead of time.
  Every "is this intern exempt?" check must compare against today rather than testing the field for
  truthiness — `isExemptToday(placedAt)` on the frontend, `isExemptOn(placedAt, dateKey)` on the
  server. `Boolean(placedAt)` is the easy mistake and it makes the UI disagree with the denominator.
- **`NonWorkingDay`** is the cohort-wide calendar of weekdays nobody owed — `{ date, label, kind }`
  where `kind` is `holiday | break | remote` (default `holiday`). `kind` is **presentation only**:
  every kind leaves the denominator identically, and nothing in the maths branches on it. It exists
  so the calendar can colour a remote week apart from a holiday's grey, which the free-text
  `label` can't be relied on to do. **Cohort-wide only** — per-intern days off (an intern requesting
  remote, calling in sick, taking leave) need their own per-intern model with a requester and an
  approval state; widening `kind` for them would exempt the whole cohort for one person's day.
  That per-intern model is `AbsenceRequest`, below. `Observance` is a third thing again — a
  religious holiday marked on the calendar as a **notice only**, which changes nobody's denominator
  and must never be merged into `NonWorkingDay`.
- **`attendanceRate` is `null`, never `0`, when nothing was owed** (`workingDays === 0`: a placed
  intern, or a month before the start date). "No obligation" and "attended nothing" are different
  facts, and a fabricated `0%` reads exactly like a real one. Every consumer must handle null —
  render `—` (`formatAttendanceRate` / `hasAttendanceRate` in `frontend/src/helpers/attendance.js`),
  exclude it from averages (`averageAttendanceRate` skips nulls), and sort it last, not as zero.
- **Check-in window** (`attendanceTime.js`): open 07:00–11:00 `Europe/Sarajevo` time on weekdays.
  The server is authoritative; the client mirrors the rule for UX only.
- Endpoints: `GET /api/attendance/me` (full history for the calendar/streak + a current-month stat
  block), `POST|DELETE /api/attendance/me/check-in` (intern-self); `GET /api/attendance` (**admin-only**
  roster, `?month=YYYY-MM&search=&hub=`, defaults to the current month, records scoped to that month
  so the payload stays bounded, and only `active`/`ready` interns — `InternProfile`'s exported
  `IN_PROGRAMME_STATUSES` — a `placed`/`completed`/`discontinued` intern drops off the roster
  entirely) and
  `GET /api/attendance/:internProfileId` (**admin-only**, one intern's full history for the
  calendar modal, no status filter). Response envelope is the standard
  `{ success, message, data }`, with `data` holding `{ attendance }` / `{ month, roster,
  nonWorkingDays, observances }`. All three read payloads carry `requestedDays` (a flat
  `'YYYY-MM-DD' → status` map of every day an approval wrote) alongside `records` and
  `cancelledDates`.
- **`splitRows` in `helpers/attendanceStats.js` is the one place raw rows become buckets**, and both
  services that compute a rate use it. `adminDashboardService` used to partition rows itself, which
  was harmless while `remote` was the only extra status and silently wrong the moment approved leave
  could write one — a fortnight of holiday would have read as perfect attendance on the dashboard
  and correctly everywhere else. Do not reintroduce a local split.
- The office-network **IP allowlist** guard (per-hub CIDR + `trust proxy`) is a deferred, optional
  step — `Attendance.checkInIp` is already captured for it.
- **Mentors cannot see attendance at all.** Every non-`/me` route is `requireRole(ROLES.ADMIN)` and
  there is no mentor-facing attendance surface. If one is ever added it needs per-mentor scoping
  via `helpers/internAccess.js` — and the intern-facing copy on `MyAttendancePage`, which says
  *admins* can see their attendance, has to change back.

### Absence requests (remote work, vacation, religious holidays, sick days)

An intern asks for days away from the usual office check-in, addressed to one admin; that admin
decides it. `server/{models/AbsenceRequest.js, services/absenceRequestService.js,
controllers/absenceRequest.js, routes/absenceRequest.js}` +
`server/constants/absenceRequestTypes.js` (the per-type table) and
`server/helpers/absenceRequestRules.js` (pure, unit-tested in `absenceRequestRules.test.js`).
Frontend: `components/attendance/{AbsenceRequestPanel,AbsenceRequestQueue,dayStatusVisuals}.jsx`,
`api/absenceRequests.js`, `queries/absenceRequests.js`.

- **One model, four types.** `type` is `remote | vacation | religious | sick`. They share a
  lifecycle, an admin queue and the approval-writes-attendance mechanic, so they share a collection.
  Everything that differs lives in **`constants/absenceRequestTypes.js`** — one row per type. A
  fifth type should be a row there plus a colour on the client, and nothing else. Never branch on
  the type in a service.

  | Type | Days per request | Yearly budget | May be backdated | Counts as |
  |---|---|---|---|---|
  | `remote` | 3 | none | no | **attended** |
  | `vacation` | 5 | 5 / calendar year | no | exempt |
  | `religious` | 3 | 3 / calendar year | no | exempt |
  | `sick` | 1 | none | 2 working days | exempt |

  The first two columns are **defaults an admin can change** — see "Configurable limits" below.
  Backdating and `attended` are fixed in code: neither is a quantity to weigh up, and `attended`
  decides arithmetic the whole attendance module rests on.

- **A request is decided as a unit.** Days need not be consecutive. Approving writes a row per day;
  rejecting refuses all of them. There is no per-day verdict — the intern chose those days together.
- **Ceilings bound a request, not an intern.** Wanting a fourth remote day means another request,
  and nothing limits how many; an intern with exams all week files two rather than being refused.
  The *budgeted* types are bounded by the yearly allowance instead, not by a request count.
- **Approval writes the attendance itself** — one `Attendance` row per day whose `status` is the
  request's own type, with `request` pointing back. No check-in happens and the 07:00–11:00 window
  does not apply. Approval **re-runs the day rules first**, because the intern may have been placed,
  or the day become a holiday, between asking and answering — but deliberately **not** the
  backdating window, or a sick day filed legitimately on Wednesday would expire if the admin took
  until Thursday to answer.
- **Remote counts as attended; the other three are exempt.** Remote is merged into the `records`
  list every numerator reads. Vacation, religious and sick leave the denominator instead, exactly as
  a cohort-wide `NonWorkingDay` does — `computeMonthStats` takes a per-intern `exemptDates` as its
  sixth argument and unions it with the cohort set. A day off is neither attended nor missed:
  counting it as attended would read a month of holiday as 100%, counting it as absent would punish
  leave an admin approved.
- **Budgets are per calendar year, charged per day.** A request straddling New Year draws from both
  years. `pending` **and** `approved` consume the allowance — if pending did not, five simultaneous
  five-day requests would each pass the check and could all be approved. `rejected`, `cancelled` and
  `revoked` release it.
- **Statuses**: `pending | approved | rejected | cancelled | revoked`. `pending` and `approved` are
  *live* and hold their days against re-requesting **across types** — one day cannot be two kinds of
  away at once. Revoke is a state, never a delete — it removes the rows it wrote
  (`deleteMany({ request })`, never by `{ intern, date }`, so a real check-in can't be caught).
- **Requestable days**: a working day, not a weekend, not a `NonWorkingDay`, not before `startDate`,
  not on/after `placedAt`, not already recorded, not already claimed by a live request. Everything
  except sick is today-or-later, so a recorded absence can never be relabelled after the fact. Sick
  is the deliberate exception in both directions: it reaches back two **working** days (you file a
  sick day after being ill, not before) and cannot be booked ahead at all.
- **Every request is addressed to exactly one admin** (`recipientAdmin`, required). The intern picks
  from `admins` (every active admin, sent alongside `types` on the intern's own list response —
  built via `adminService.getUsers`, no separate "list the admins" endpoint), preselected to the
  configured **primary admin** (`AbsenceRequestSettings.primaryAdmin`, below) when one is set.
  Omitting `recipientAdmin` falls back to that primary admin server-side; if neither is set, create
  is refused with a 400 rather than silently addressing the request to nobody. This is what lets an
  intern route around a primary admin who is on leave (pick someone else) without the request
  reaching both of them — the id is validated as an existing **active admin** before it is trusted,
  the same "check the foreign key" rule `.claude/docs/security.md` states for workspace refs,
  generalized here to a role check. The admin **queue stays shared**: `listRequests` is unfiltered,
  so every admin can still see and decide every pending request regardless of who it was addressed
  to — `recipientAdmin` only targets the notification below and the queue row's "for" tag.
- **Two notifications, one per axis** (both fire-and-forget from `absenceRequestService`, both via
  `internNotificationService`): `absence_request_pending` (staff-facing) tells the resolved
  `recipientAdmin` a request needs a decision, sent once at creation from `createMyRequest`.
  `absence_request_decided` (intern-facing) tells the intern the verdict — approved or rejected —
  sent from `decideRequest` after the status is saved. Neither fires for a revoke: revoking undoes
  an approval already communicated, not a new decision to announce.
- Endpoints: `GET|POST /api/absence-requests/me`, `DELETE /api/absence-requests/me/:id`
  (intern-self); `GET /api/absence-requests?status=pending|all&type=…`,
  `PATCH /api/absence-requests/:id` (approve/reject), `DELETE /api/absence-requests/:id`
  (revoke) — **admin-only**. The intern list also returns `types`, carrying each type's ceiling,
  remaining allowance and requestable bounds, so **no limit is duplicated on the client**.
  `pendingCount` on the admin list is deliberately unfiltered, so the nav dot and tab badge keep
  meaning "anything waiting" while a type filter is applied.
- **The admin surface is `/admin/absence-requests`** (`pages/AdminAbsenceRequestsPage.jsx`) — three
  tabs: Queue, History, Request limits. `AbsenceRequestQueue` renders the first two off a `mode`
  prop; history asks for `status=all` and drops the pending rows, because the API filters on one
  status at a time and "decided" is four of them. `/attendance` keeps only the reports.

#### Configurable limits, and the primary admin

An admin sets the per-request ceiling and the yearly allowance per type, and the primary admin
default, from the Request limits tab of `/admin/absence-requests`.
`server/{models/AbsenceRequestSettings.js, services/absenceSettingsService.js,
controllers/absenceSettings.js, routes/absenceSettings.js}`. Frontend:
`components/attendance/AbsenceLimitsPanel.jsx`, `api/absenceRequestSettings.js`,
`queries/absenceRequestSettings.js`.

- **One document, global.** `key: 'global'`, unique — a second row cannot be written, so the
  effective configuration never depends on a sort order. Global rather than per-workspace on the
  same grounds as `NonWorkingDay`: an `AbsenceRequest` carries no workspace at all.
- **Only differences from the shipped table are stored**, for the per-type `limits`. An empty map
  is a system running as shipped, which makes "reset to defaults" a deletion and lets a later
  change to `constants/absenceRequestTypes.js` still reach types nobody overrode. Saving a value
  equal to the default therefore stores nothing — "unset" and "set to the default" mean the same
  thing. `primaryAdmin` has no such default to fall back to: it is either an admin's id or `null`,
  and `resetSettings` (the "Reset to defaults" button) never touches it — that button is about the
  per-type numbers only.
- **`primaryAdmin`** (`ObjectId ref: 'User'`, nullable) is who an intern's request is addressed to
  when they don't pick someone else — see "Absence requests" above. Validated the same way a
  request's own `recipientAdmin` is: must be an existing user with `role: 'admin'` and
  `status: 'active'`, or the save is refused with a 400. `null` means "no default" — the intern's
  form then has no preselection and must pick explicitly, it never silently falls back to "some
  admin".
- **Unbudgeted stays unbudgeted.** `remote` and `sick` have no yearly allowance and an admin cannot
  give them one — `yearlyBudgetFor` returns `null` for them whatever is stored. Read off the table
  (`yearlyBudget: null`), so the fact is stated once. Their *ceilings* are configurable.
- **The rules take limits as an argument.** `helpers/absenceRequestRules.js` and
  `constants/absenceRequestTypes.js` stay Mongoose-free; `absenceRequestService` loads the
  limits (`getEffectiveLimits()`) and passes them down. Omit the argument and everything falls back
  to the shipped defaults — which is what keeps the rules unit-testable without a database.
- **The per-type ceiling is not a schema validator.** `AbsenceRequest.dates` is bounded by the
  absolute `LIMIT_BOUNDS.maxDaysPerRequest.max` instead. A validator holding a number an admin can
  lower would make an existing five-day request unsaveable the moment the ceiling dropped to
  three — so approving one filed last week would fail validation on a document that was legal when
  written.
- **Lowering a limit binds only what comes next.** Nothing already filed is re-validated or
  revoked, and `budgetStateFor` clamps `remaining` at zero: an intern who spent four when the
  allowance drops to three is out of days, not owed minus one.
- Endpoints: `GET|PUT|DELETE /api/absence-request-settings` — **admin-only in both directions**.
  Interns never call them; the per-type numbers and the primary admin's identity reach them already
  resolved, in the `types`/`admins`/`primaryAdmin` fields of their own request list.

### Religious observances

`server/models/Observance.js` + `helpers/observanceCalendar.js` (pure, tested) +
`seeder/{defaultObservances.js,seedObservances.js}`, `npm run seed:observances`.

- **A notice and nothing more.** An observance marks a day on the calendar so an intern can see it
  coming. It removes nothing from anyone's denominator and excuses nobody — the intern is the one
  who decides it applies to them, by filing a religious-holiday request. It is **not** a
  `NonWorkingDay`: writing Orthodox Christmas into that collection would exempt the entire cohort,
  including everyone who does not observe it.
- **Computed, not typed.** Twenty years (2026–2045, ~364 rows) generated from the Gregorian and
  Julian computus and the Hebrew calendar's arithmetic, all pinned against published dates in
  `observanceCalendar.test.js`. Hand-writing four hundred dates would be unreviewable and would rot.
- **The Islamic dates are `provisional: true`.** In Bosnia they are announced by the Islamic
  Community rather than calculated, and land within about a day of the tabular calendar. The UI says
  "to be confirmed" on them, and `npm run seed:observances -- --replace` is how a corrected year
  gets in. An intern planning leave around a date the app stated confidently and got wrong is the
  exact failure this feature exists to prevent.

### Attendance colours

`frontend/src/components/attendance/dayStatusVisuals.jsx` is the single source; the calendar, both
admin tables and the dashboard week strip all read from it.

- **No hue is safe, because `--primary` moves.** `styles/themes.css` ships primaries at hue 239
  (indigo), 262 (violet), 293 (fuchsia), **346 (crimson)**, **6 (coral)**, **24 (orange)**,
  173 (teal), 199 (sky) and 222 (navy), plus two neutrals — a near-black warm brown in `ash` and pure
  achromatic black/white in `mono`. Orange is Sick and red is Absent, so in the `sunset`, `ruby`
  and `rose` themes a status colour *is* somebody's primary.
- So the system separates the axes: **fill says what happened** (a fixed hue per status, never
  `--primary`), **a ring says when** (today is drawn as a ring over whatever the day actually is, so
  it survives the intern checking in), and **a glyph says which** (every away-from-the-office state
  carries a mark; Present and Absent carry none, which keeps an ordinary month quiet).
- Five families: Attended (`present`, `remote`), Approved absence (`vacation`, `religious`, `sick`),
  Not owed (`weekend`, `non-working`, `before-start`, `exempt`), Missed (`absent`), and Now.
  On-project moved out of amber into the neutral family, where it belongs — it means "no
  obligation", the same as a weekend — which is also what freed orange for a sick day.
- The glyph, not the hue, is what actually separates the four away states: blue-vacation sits 27°
  from violet-religious and orange-sick sits 30° from red-absent, and no shuffling fixes that.
  Encoding the difference in shape as well is also the only version that works for a colour-blind
  viewer. Religious leave uses a plain `Star`, and **the calendar draws no distinction between
  faiths anywhere** — the same star marks every observance in the advance notice. The request
  itself never records which faith it is for (`AbsenceRequest` holds a type and dates, nothing
  else), and in the notice the label already names the holiday, so per-faith symbols would only
  rank traditions by which ones happen to have an icon available. `Observance.tradition` is still
  stored; it just isn't what draws the mark.
- A pending request raises a pulsing dot on the admin's Attendance nav row (`item.dot` in
  `AppSidebar.jsx`).

## Admin dashboard (workspace-scoped)

The admin landing board: one workspace at a time — the caller's **active** workspace. Backend:
`server/{services/adminDashboardService.js, controllers/adminDashboard.js}` + `GET /dashboard` in
`routes/admin.js`. Frontend: `pages/AdminDashboardPage.jsx`, `components/admin/dashboard/*`.

- **`/dashboard` is role-split three ways**, not separate routes: `DashboardRoute` in
  `routes/AppRoutes.jsx` renders `AdminDashboardPage` for admins, `InternDashboardPage` for interns,
  and `UserDashboard` (assigned tickets) for mentors. It sits **outside `WorkspaceGuard`** so neither
  an admin nor an intern without an active workspace is redirected to `/create-workspace` — each
  board explains the state instead. The guard's redirects are repeated inside `DashboardRoute` for
  the mentor branch only. **Don't widen `WorkspaceGuard` instead**: `/tickets`, `/dailies` and
  `/analytics` all assume a resolved `user.workspaceId`.
- **The page has no workspace picker of its own** — it reads `user.workspaceId`; switching is the
  sidebar's `WorkspaceSwitcher`, which already `refetchUser()`s and navigates to `/dashboard`, so the
  board re-keys and refetches by itself. The switcher lists only workspaces the caller is a *member*
  of and collapses to a static "Global admin mode" label when an admin has no active workspace —
  which is why the empty state points at `/admin/workspaces` rather than the sidebar.
- **Scoping goes through `Workspace.members`, never `User.workspaceId`**
  (`helpers/workspaceInterns.js#getActiveWorkspaceInterns`, also used by `dailyService`).
  `InternProfile` has **no** `workspace` field, and `User.workspaceId` is only the member's
  *currently active* workspace, so scoping on it would drop interns who belong here but are switched
  elsewhere.
- **Presence and the workload table count only in-programme interns**
  (`InternProfile.IN_PROGRAMME_STATUSES` — `active`/`ready`, the same list the attendance roster
  filters on): a placed or discontinued intern has no live workload or attendance to report.
- **Placement and specialization cards are platform-wide, and they are the only global things on the
  page.** "Last intern placed", "Recent placements" and the *Specialization assigned* half query
  across the whole platform, unscoped — these are programme-level milestones on the intern's profile,
  and per-workspace scoping made the same row appear and vanish as the admin switched workspaces.
  Safe because the route is admin-only. `LastPlacementCard` carries a help tooltip saying so, since a
  global number on an otherwise workspace-scoped board is surprising. The specialization half reads
  `specializationAssignedAt` as the marker (never `secondaryMentor` alone — ADR-0002). Everything
  else on the payload stays workspace-scoped.
- **Workload segments are a fixed four** (`to do`, `in progress`, `on staging`, `blocked` —
  `WORKLOAD_SLUGS`, module-private to the service), so every table row has the same shape.
  Labels/colors come from the workspace's own `TicketStatus` rows, falling back to
  `statusService.DEFAULT_STATUSES`. `done`/`backlog` are excluded — the table is open work in flight.
  `Ticket.assignedTo` is an array, so a shared ticket counts once per assignee.
- **Composed from one new endpoint plus reuse**: `GET /api/admin/dashboard?workspaceId=`
  (**admin-only**; 400 on a malformed id, 404 on unknown/archived — it verifies the workspace exists
  because `assertWorkspaceAccess` short-circuits for admins without touching the DB, so a bogus id
  would otherwise return a convincing all-zeros payload). The standup card reuses
  `GET /api/dailies/admin/overview`; the intern picker behind the quick actions reuses
  `GET /api/interns`.
- **Known gap — the standup card's denominator differs from the interns table.**
  `dailies/admin/overview` counts every active intern member, including `placed` ones, so a workspace
  can read "1 intern" in the table and "0 / 3 notes in" on the standup card. Fixing it means
  filtering `getWorkspaceDailyOverview`'s roster to in-programme interns, which also changes the
  existing Daily Insights page — deliberately left alone.
- **The quick actions are one catalog, selected per account.** `frontend/src/helpers/quickActions.js`
  holds every action for every role that has a card (`roles` per entry) plus the pure functions that
  turn a stored selection into rows; `components/admin/dashboard/QuickActionsCard.jsx` only draws
  them. An action is one of three kinds — `to` (navigate), `opens` (the page's single `openAction`
  state raises a modal), `pending` (says out loud that it is not built).
  - **It is a selection, not a fold.** An account picks the actions it wants; the rest are simply
    not on the dashboard, which is cheap because everything in the catalog is also in the sidebar.
    `QUICK_ACTIONS_DEFAULT_COUNT` (5) is what a card opens with; `QUICK_ACTIONS_MAX` (5) is the
    ceiling — the card is a rail card beside the standup, and more rows push that column past the
    interns panel it is meant to end level with. The two constants must move together —
    `frontend/src/helpers/quickActions.js` and its mirror in `server/constants/userPreferences.js`
    (which feeds `maxLength`) — and everything downstream already reads the number: the editor's
    counter and refusal, the client validation, the server's 400, and the tests, which pass a cap
    explicitly so they pin both behaviours.
  - **The card has no editor.** Which actions, and in what order, is
    `components/settings/QuickActionsRows.jsx` — a Settings section with **two dnd-kit zones**: *On
    your dashboard* (sortable, the card's order) and *Available* (the rest of the role's catalog).
    Dragging across adds or removes, dragging inside the first orders, and `+` / `×` on each tile do
    the same thing without a drag — cross-zone keyboard dragging works, but an operation only a drag
    can perform is one some people cannot perform at all. The card stays a plain list of click
    targets and its header links to Settings: every row there is a `Link` or a `button`, so an editor
    sharing those rows means dnd-kit listeners fighting the click and swallowing Enter.
  - **Collision detection is pointer-first** (`pointerWithin`, falling back to `closestCorners`).
    Distance-based detection answers with the zone the tile is still *in* — its own container
    surrounds it — so a drag from Available into the dashboard list landed on nothing at all: no
    error, no move, a tile springing back. The fallback is not optional: a keyboard drag has no
    pointer. Zones are droppable in their own right, or an empty one could never be dropped into.
    Pointer activation is distance-6, keyboard reorder goes through a named grip, and the sortable
    transition is dropped when the account's `motion` preference is `reduced`.
  - **The stored value has three states, and they are not interchangeable** — see "UI preferences".
    Absent means "never chosen", so the card shows the first five of the role's catalog and a later
    change to that catalog still reaches everyone who has not chosen. A stored list means exactly
    those, in that order: an action added later does **not** evict one of five deliberate picks. A
    stored *empty* list means "no quick actions", and the card says so rather than quietly refilling.
  - The cap, when armed, is enforced on both sides. The client's `isValidQuickActionOrder` refuses
    to cache one over the limit (which is what stops the editor saving it), and `buildUpdate` refuses
    the write with a 400 rather than truncating — storing five of six and reporting success would
    leave the caller believing in a row nothing will ever draw. Both take the cap as an argument
    defaulting to the constant, so the tests pin both behaviours whichever way it is currently set.
  - **Two actions do not point where you would guess, and both learned it the hard way.**
    *New workspace* goes to `/admin/workspaces?new=1`, **not** `/create-workspace`: that page is the
    first-workspace flow and `AppRoutes.jsx` redirects an admin who already has one straight back to
    the dashboard, so the action appeared to do nothing. *Attendance today* goes to
    `/attendance?view=day`, because the By-day switcher is what starts on the current day. Both pages
    seed a local UI state from the query string once, on mount, and the control owns it afterwards —
    flipping back to Month does not fight the URL.
  - **`roles` is a display filter, not authorization.** Every action's target keeps its own server
    guard — see `.claude/docs/security.md`. Two rules there are enforced in a *service* rather than on
    a route, so they are easy to get wrong from the catalog: readiness is admin-only
    (`readinessFlagService.upsertReadinessFlag`) and so is creating a recommendation, while
    evaluations and notes go through `canWriteMentorData` (admin **or** the assigned mentor).
  - **Two-stage actions share one picker.** `PICKER_FLOWS` in `AdminDashboardPage.jsx` maps an action
    to its copy and the form its pick opens; `InternPickerModal` takes `restrictToRecommendable`,
    because "already placed / has left" disqualifies an intern from being *recommended* and from
    nothing else — a note or a readiness assessment about them is legitimate.
  - **The mentor's rows are declared but nothing renders them yet.** The mentor's `/dashboard` is
    still `UserDashboard` (assigned tickets), so the card has nowhere to live; the rebuild mounts this
    one instead of inventing a second list, and must supply a picker scoped to *its* interns.
- **Not implemented**: the *Mark absence / excuse* quick action is a "Soon" placeholder — `Attendance`
  has no write path for absence at all (absence is the lack of a check-in, and only interns check in),
  and `POST /api/absence-requests/me` is intern-only too, so an admin cannot even file on someone's
  behalf. It is deliberately the *only* pending row.

## Intern dashboard (self-scoped)

The intern's landing board. Backend: `server/{services/internDashboardService.js,
controllers/internDashboard.js}` + `GET /me` in `routes/dashboard.js`. Frontend:
`pages/InternDashboardPage.jsx`, `components/intern/dashboard/*`.

- **`GET /api/dashboard/me` takes no parameters, ever.** Intern-only, read-only, and the subject is
  always `req.user` — there is deliberately no `?workspaceId=` / `?internId=` override like the admin
  board has, because this payload carries the caller's own recommendations and evaluations. That is
  the whole security model; see `.claude/docs/security.md`.
- **Attendance is NOT on the aggregate.** The hero reads `GET /api/attendance/me`, which already
  returns the full record history its streak and week strip derive from and is the cache the check-in
  mutation seeds and invalidates. Folding it in would give the hero two sources that disagree for a
  frame after checking in.
- **Interns read their own recommendations and evaluations** through
  `recommendationService.listOwnRecommendations` / `evaluationService.listOwnEvaluations` — narrow
  self-only reads, separate from the admin list functions, returning **redacted** shapes that pick
  fields explicitly rather than deleting them. Withheld: `recommendationNote`,
  `interviews[].feedback`, `result.note`. Evaluation `notes` are now shown (see "My Progress"
  below); this card does not render them, but the payload carries them.
  See `.claude/docs/security.md`.
- **The "My Selection Process" card shows one recommendation at a time, out of all of them.**
  `loadPipeline` returns `current` (newest by `updatedAt`), `items` (the whole redacted list — same
  `formatOwnRecommendation` shapes, so nothing extra rides along) and `total`. The card renders a
  `‹ n/N ›` switcher when `items.length > 1` and clamps its index, because a recommendation resolving
  reorders the list underneath it. The interview line shows the **soonest upcoming** interview,
  falling back to the most recent past one labelled as past — stored order is not chronological.
- **Ticket ordering lives in `server/helpers/ticketUrgency.js`**, extracted and unit-tested because
  the board's "start here" card is chosen entirely by it. Weights are additive, not a first-match
  ladder, so a blocked *critical* ticket outranks a blocked *low* one; `OVERDUE` has to clear the sum
  of every other weight, and the suite pins that.
- **Workload reuses the admin board's four segments** (`WORKLOAD_SLUGS`, kept in sync between the two
  services) with the workspace's own `TicketStatus` colours.
- **The full ticket list is `/tickets?assignee=me`**, not a second page, and one status of it is
  `/tickets?assignee=me&tab=<status-slug>`. `TicketPage` seeds its assignee filter from that param
  (`me` resolves against the signed-in user, so the link carries no id) and writes it back, so the
  filter survives a refresh and the URL stays shareable. The seed runs **once**, guarded by a ref —
  re-applying it would make clearing the "Assigned: …" chip snap straight back, because the
  write-back rewrites the param the seed reads.
  Every workload segment links to the filtered form through
  `components/intern/dashboard/workloadLink.js`, which encodes the slug the way `TicketPage`'s
  `decodeTabParam` expects (spaces become underscores, since slugs are space-separated). An unknown
  `tab` falls back to `all` via `allowedTabKeys`. Note the destination's tab counts are
  workspace-wide while the card's are the caller's own, so the two numbers legitimately differ.
- **Standup notes over `SUMMARY_MIN_CHARS` are shown AI-summarised**, expandable to the full text.
  `POST /api/dashboard/me/standup-summary` (intern-only, parameterless) →
  `services/standupSummaryService.js` → Groq, via its own prompt in `prompts/standupPrompts.js`.
  That prompt only *condenses*; do not merge it with `ticketPrompts.buildUserSummaryPrompt`, which
  deliberately writes an appraisal.
  - **The summary is cached on the `Daily` entry itself** (`entries[].aiSummary` — text,
    `sourceHash`, `generatedAt`), not in its own collection: it is derived from exactly that text,
    read only alongside it, and deleted with it.
  - **`sourceHash` is the freshness rule** — it digests the lines the summary came from, so editing
    the note stops the hash matching and the summary is treated as absent rather than shown stale.
    Both the read path and the generate endpoint go through `helpers/standupNote.js`, so they cannot
    disagree about which notes qualify or whether a cached summary still applies.
  - The card fires the mutation itself when the server sets `needsSummary`, guarded by a ref so a
    failed generation retries at most once per note per mount rather than hammering the provider.
  - **The note is the default view; the summary is a toggle, not a replacement.** Both are cut to
    hard per-section character caps and **nothing expands in place** — this card is one of three
    across a row, so its height *is* the row's height. "View full note" navigates to
    `/dailies?date=YYYY-MM-DD` instead.
- **`/dailies` accepts `?date=YYYY-MM-DD`**, seeding and syncing `selectedDate` (today carries no
  param). Parsed at noon so the day cannot slide in a timezone behind UTC.
- **Shared with the admin board**: `components/dashboard/{DashboardCard, DashboardHeader,
  WorkloadSegments, AttendanceMeter}` and the `.dashboard-hero-surface` gradient (whose theme-accent
  and contrast constraints are documented at the rule in `frontend/src/index.css`).
- **The hero's week strip is Mon–Fri, five cells** (`buildWeekStrip`). The weekend is not a state of
  an intern's week — nobody is expected in and nothing is owed — and two inert cells took a seventh
  of the strip each from the days that carry a verdict. Anything asking "is today a weekend?" calls
  `isOfficeWeekend` rather than looking for a cell that is not there; the month calendar on
  `/my-attendance` still draws weekends, where they are part of the shape of the month.
- **Not implemented**: weekly hours on the hero (`Attendance` records a check-in and no check-out, so
  hours aren't derivable — the line shows the month's attendance rate and present days instead), and
  the "next review in N days" line on evaluations (no scheduled-review concept exists in the model).

## My Progress (intern self-scoped, read-only)

The intern's read-only mirror of everything the programme records **about** them, at
`/my-progress` — the dashboard cards show the headline, this page is the record. Backend:
`server/{services/internProgressService.js, controllers/internDashboard.js}` +
`GET /me/progress` in `routes/dashboard.js`, with the arithmetic in
`server/helpers/{evaluationTrend,readinessSummary}.js` (both unit-tested). Frontend:
`frontend/src/pages/MyProgressPage.jsx`, `components/intern/progress/*`,
`api/internProgress.js`, `queries/internProgress.js`.

- **`GET /api/dashboard/me/progress` takes no parameters, ever** — same rule and reason as
  `GET /api/dashboard/me`, and more load-bearing: this is the widest self-read on the platform. See
  `security.md`. Every section in one payload (`programme`, `evaluations`, `readiness`,
  `recommendations`, `mentorNotes`) so the page has one loading state and one cache key for the
  socket refresh to land on — an endpoint each would refresh four sections and leave the fifth stale.
- **Nothing on it is workspace-scoped.** Every section is programme data, so unlike the dashboard
  aggregate there is no `resolveActiveWorkspaceId` call in the service and the route sits outside
  `WorkspaceGuard` — an intern between workspaces still has a review history.
- **Read-only is a property of the data, not a UI convention.** Evaluations
  (`evaluationService.createEvaluation`), readiness (`upsertReadinessFlag`) and recommendations
  (`requireRole(ADMIN)` on `/api/recommendations`) are all admin-authored; the service only reads
  and there is no mutation hook in the page's component tree.
- **Evaluation `notes` are shown here** — the reversal of a previously documented decision, with the
  reasoning on `formatOwnEvaluation` and in `security.md`. `MentorComment` stays invisible to
  interns and must not be folded in; it has its own `visibleTo` recipient list and its existing rows
  were written under an expectation of staying internal.
- **Readiness is a join, not a list of flags.** `helpers/readinessSummary.js` drives the rows from
  the intern's *declared* technologies and position, so a declared technology nobody has assessed
  gets a "Not assessed" row (that gap is the actionable part of the section) and a position flag
  left over from a previous role reads "Not assessed" rather than carrying a stale level forward —
  the same rules `InternReadinessPanel` / `InternRoleReadinessPanel` apply for the admin.
- **Only the newest evaluation carries movement chips**, computed server-side by
  `helpers/evaluationTrend.js` from the two newest periods — the comparison the chip claims to be. A
  `null` delta ("no earlier period") renders nothing; a `0` delta renders "Same", because held
  steady and never-measured are different facts.
- **Stage logic is shared with the dashboard card**, not copied:
  `frontend/src/helpers/recommendationStages.js` holds the stage vocabulary, the
  skipped-vs-pending rule and the "which interview comes next" pick, and both `MyPipelineCard` and
  the progress page's recommendation section import it. Still deliberately separate from the admin's
  `components/interns/recommendations/recommendationUi.jsx`, which carries that redesign's own
  hardcoded palette and font stack.
- **`emitInternDataChanged()` now fires on evaluation create and readiness upsert too** (it
  previously fired only from `internService`, `recommendationService` and `specializationService`).
  Without it an admin recording an evaluation left both this page and the dashboard's evaluations
  card stale indefinitely for an intern sitting on them. The frontend's `invalidateInternScope`
  refreshes `internProgressKeys.all` plus the `intern-readiness` / `intern-profile` keys that
  `/my-technologies` reads.
- **Attendance is deliberately not on it** — `/my-attendance` owns that surface and the dashboard
  hero already reads `GET /api/attendance/me`; a third copy of the same month's numbers is a third
  thing to keep in agreement. The programme panel links there instead.
- **The page is a summary band over collapsible cards**, in one column. The band
  (`components/intern/progress/ProgressHeader.jsx`) answers "where do I stand?" outright — status
  and its sentence, a *time-elapsed* meter (nothing in the payload measures attainment, and a bar
  that implied it would be inventing a score), and three counts whose tiles open the section they
  summarise. Every card below starts closed and states its own count on the band, so a shut page
  still reads. Length inside a section is handled by condensing, not hiding: the newest evaluation
  and the newest recommendation render in full, everything older is one line. There is no right-hand
  rail — an index of a page is what you need when you cannot close it.
- The lifecycle status is printed **verbatim** (no label mapping, per the rule in
  `frontend/src/helpers/internProfile.js`) with a plain-English sentence beside it from
  `components/intern/progress/programmeStatus.js`. Keep those as sentences: the moment one becomes a
  two-word noun it has turned into the label mapping the rest of the app avoids.

## Glossary

Platform-wide reference terms. Terms resolved during feature design live in `CONTEXT.md` — check
there first for anything in the dailies, projects, specializations, staffing-request or placement
vocabulary. Get the two "admin" meanings right.

| Term | What it is |
|---|---|
| **Workspace** | Multi-tenant container. Scoping anchor for tickets, statuses, categories, comments, rooms. Every ticketing operation is constrained to one. |
| **Platform role** | User-level role: `admin`, `mentor`, `intern`, `leadership` (`server/constants/roles.js`). Drives login landing + route guards. |
| **Workspace-membership role** | Per-workspace `admin` / `member`, **independent** of platform role. Controls workspace management actions. ⚠️ A platform `admin` and a workspace `admin` are *not* the same thing — don't conflate them in authz. |
| **Hub** | Physical office location (`name`, `city`, `country`) — e.g. Sarajevo, Belgrade, Skopje, Medellín. Reference data. A user belongs to a hub. |
| **InternshipType** | The programme track an intern is on — reference data keyed by `slug`. E.g. `fep`, `shadow`. |
| **FEP** | **Future Experts Program** — the standard internship track (`slug: 'fep'`). Common in seed data and intern emails (`intern.active.fep@…`). |
| **Position** | A target job role (`slug` + `name`) an intern is training toward — e.g. QA, Frontend. Reference data. |
| **Technology** | A tech skill (React, Node, …). Reference data; attached to intern profiles and readiness flags. |
| **Readiness flag** | Per-intern assessment of readiness for a specific **technology** or **position**, level `none \| learning \| ready`, recorded by a user (`ReadinessFlag`). Admin-only (view and set). Feeds placement decisions. |
| **Intern status** | Lifecycle of an `InternProfile`: `active → ready → placed → completed`, or `discontinued`. Changing it is admin-only, even for the intern's assigned mentor. |
| **Primary / secondary mentor** | An intern has a primary mentor and optionally a secondary; both gate mentor access (`server/helpers/internAccess.js`). The secondary is now *only* the specialization mentor — see ADR-0002. |
| **Project** | A client engagement the firm is running — `title/client/description/tech tags/status/type`. Admin-managed reference data; a recommendation refs one. Not workspace-scoped. |
| **Attendance / check-in** | An intern's office check-in for one day (`Attendance` — one sparse doc per intern per acted-on day; present days stored, absent days derived). Window 07:00–11:00 office time, weekdays. Reported **per calendar month**; stats always computed, never stored. |
| **Recommendation** | An admin's placement proposal for an intern on a `Project`, moving `recommended → interviewing → resulted` with a separate `placed`/`not_placed` outcome. Mentors have no access. Each is resolved individually — resolving one never touches the intern's others. Pipeline KPIs count distinct interns, not recommendation records. |
| **Staffing request** | Leadership's record of demand from outside the platform: a project needing N interns placed on it. Demand only — who is on a project is read off the recommendations tagged to it. |
| **Ticket status** | **Per-workspace, customizable** — not a global enum. Statuses live in `TicketStatus`, validated via `statusValidation` / `statusSlugAliases`. A status's `slug` is its identity; a rename changes the label only. |
| **Blocker** (`Ticket.blockedBy`) | Why a ticket can't move while it is **Blocked** — an optional ticket from the same workspace it waits on, plus an optional free-text note for when nothing on the board is the reason. Either half may be empty; both are cleared when the ticket leaves Blocked. |
| **Story points / time-in-status** | Ticket estimation field; time-in-status tracks how long a ticket sits in each status column. |
| **Sprint** | A named stretch of calendar time in a workspace (`server/models/Sprint.js`: name, start, end, optional goal). State (`upcoming`/`active`/`past`) is derived from its dates, never stored; two sprints in a workspace may never overlap. See `CONTEXT.md` and ADR-0009/0010/0011. |
| **Invalidation scope** | Socket.IO room key (`user:` / `workspace:` / `workspace-tickets:` / `ticket:` / `workspace-dailies:` / `intern:all` / `staffing-news:all`) that drives React Query cache invalidation. |
