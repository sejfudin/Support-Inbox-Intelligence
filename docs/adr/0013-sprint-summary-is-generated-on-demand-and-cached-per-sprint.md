# The sprint summary is generated on demand and cached per sprint

## Status

accepted

## Context

The Sprints → Summary tab shows an AI recap of one sprint — what shipped, grouped into a few named
themes, team-wide and per person — alongside a derived carry-over list. The recap needs a home and
a trigger.

Two forces pull against each other. A Groq call costs money and a few seconds, and the same sprint
is opened many times, so the recap cannot be regenerated on every view. But a sprint is not a
frozen thing while it runs: tickets land, move and get re-estimated daily, so a recap pinned at
one moment goes wrong for the active sprint within a day.

ADR-0012 already faced the "when did this sprint end" question for the sealed numbers and answered
it without a clock or a button: a past sprint's numbers are written down the first time it is read
after its end date. The recap could ride that same seal — generate it once, when the sprint seals,
and never again. But that spends a Groq call on every finished sprint whether or not anyone ever
opens its Summary tab, and it gives the active sprint no recap at all, which is the tab's most
useful case (a mid-sprint "where are we").

## Decision

**The recap is generated on demand and cached as one `SprintAISummary` document per sprint,
replaced wholesale on regenerate. For a finished sprint the "demand" is opening its Summary tab;
for the active-sprint preview it is a manual click.**

- `GET /api/sprints/:id/summary` returns the cached document, or the numbers alone with
  `hasSummary: false` when none exists. `POST /api/sprints/:id/summary` runs one Groq call and
  upserts the document. Any active workspace member may do either — the same authorization as
  editing a sprint.
- **The Summary tab lists finished sprints most-recently-finished first, and auto-fires the `POST`
  the first time a finished sprint with no recap is shown** (client-side, once per sprint per
  mount; a failure stays visible and is retried only on a manual click). There is no server-side
  "sprint ended" event — a sprint's state is read off the calendar (ADR-0010) — so this is the
  same seal-on-read shape ADR-0012 uses, moved to the client and gated on someone actually looking.
  The running sprint is never auto-generated: its board moves daily, so firing it on every visit
  would burn calls for a recap that is stale by the next day.
- **No numbers are stored.** Story points and ticket counts, team-wide and per person, plus the
  carry-over list, are recomputed on every read by `helpers/sprintRules.js` — the helper the
  progress strip already uses. The document holds only the model's prose. A recap and the strip
  beside it therefore cannot drift apart, and the tab is useful (numbers, carry-over) before any
  Groq call is made.
- **Freshness is a hash, not a timestamp.** `SprintAISummary.sourceHash` digests the sprint's
  ticket state at generation time — task number, bucket, points and assignees per ticket, order
  independent (`helpers/sprintSummaryData.js`). A read recomputes it from the live tickets and
  marks the recap `stale` when the two diverge. This is the mechanism `helpers/standupNote.js`
  uses for the standup card. Editing a ticket title alone does not invalidate the recap; moving,
  re-estimating or re-assigning a ticket does.
- The active sprint's recap is thus a **preview** — regeneratable at will, and flagged stale as
  soon as the board moves under it. A finished sprint's ticket set barely changes, so its recap
  stays fresh until someone chooses to regenerate.

## Consequences

- **A finished sprint with nobody looking at it has no recap, and costs nothing.** The opposite of
  the seal-time approach, and the reason on-demand was chosen: the spend follows attention.
- **The recap can lag the board.** For the active sprint that is expected and labelled; `stale`
  tells the reader to regenerate. For a past sprint it is nearly moot.
- **A Groq call is triggered by a person — a click, or opening a finished sprint's tab — never a
  background job.** So an unconfigured or failing provider is a visible error (503/502, nothing
  persisted), never a broken page, and the carry-over list and per-person numbers still render
  regardless. A failed auto-fire is not retried until a manual click. This matches every other AI
  surface in the app.
- **One document per sprint, overwritten on regenerate.** No history of past recaps is kept;
  "regenerate" means "replace". A recap is a draft aid, not a record — the sealed numbers
  (ADR-0012) are the record.
- The freshness hash deliberately ignores ticket-text edits. A recap that re-ran every time
  someone fixed a typo in a ticket title would burn calls for no change in substance; the tradeoff
  is that a substantive title rewrite needs a manual regenerate to be reflected.
