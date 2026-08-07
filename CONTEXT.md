# Domain Language

The project's ubiquitous language — the canonical term for each domain concept, so
code, issues, and docs all use the same word for the same thing. This is a glossary,
not a spec. A broader reference glossary of platform-wide terms lives in
`.claude/docs/architecture.md`; this file holds terms actively resolved during design.

## Dailies

**Daily**:
A workspace's standup record for a single calendar date — one per workspace per day,
recorded live by a scribe. Starts empty; entries are added as the standup runs.
_Avoid_: standup (the ceremony), meeting, scrum.

**Daily entry**:
One intern's slot within a Daily: lists of what they did (done), what they'll do (todo),
and their blockers — each blocker is text with one optional linked workspace ticket. Added by the scribe
per intern; mentors/admins scribe but don't get an entry. Having an entry means the intern
was present — there is no separate present flag.
_Avoid_: row, update, report.

**Scribe**:
The workspace member who records a Daily (creates it and adds/edits entries). Not a stored
role — any active workspace member can scribe, and it can rotate day to day.
_Avoid_: facilitator, note-taker, owner.

**Presence**:
Implicit attendance: an intern with an entry in a Daily was present; one with no entry is
absent for that date. There is no explicit present/absent field. Distinct from the separate
self-check-in **Attendance** feature (to be reconciled later).
_Avoid_: checked-in (that belongs to the Attendance feature), present/absent flag.

**Edit window**:
The period a Daily stays editable: its date up to one working day in the past. Older
Dailies are frozen read-only history.
_Avoid_: grace period, lock time.

## Specializations & positions

**Main position**:
The single `Position` an intern self-declares as their focus — the existing
`InternProfile.declaredPosition` field. Required for the intern to be meaningful, but
not enforced at registration.
_Avoid_: primary role, first choice.

**Secondary position**:
An **optional**, nullable second `Position` the intern also declares interest in. Must
differ from the main position when set. No placement logic depends on it — there is no
pool of open positions in scope. Its only consumer: the admin may later confirm it as the
intern's specialization. A day-one "pick both" nudge is a social convention, never a
code-enforced invariant.
_Avoid_: fallback role (there is no fallback-placement path yet), primary/secondary role.

**Specialization**:
The admin confirming **one of the intern's two declared positions** (main or secondary —
hard-constrained, never a free position) as the intern's focus, **paired atomically** with a
dedicated 1-on-1 mentor. Position + mentor are set together in one action — no half-states.
Assigned **only by a platform admin**; mentors receive the pairing but never create it.

Mechanics:
- Marker is a new `InternProfile.specializationAssignedAt` timestamp. **Set ⟹ `declaredPosition`
  IS the specialization.** No separate "which position" field — assignment always lands the
  confirmed position in `declaredPosition`.
- If the admin picks the **secondary** position, main and secondary **swap** so the confirmed
  position becomes `declaredPosition` and the old main drops to secondary. Picking the main is a
  no-op swap.
- While set: `declaredPosition` is **locked to the intern** (read-only, shown with a
  SPECIALIZATION badge, promoted to the top slot). The **secondary stays intern-editable**.
- **Clear**: drop `specializationAssignedAt` + `secondaryMentor`. **No un-swap** — the position
  stays where the swap left it; the intern simply regains edit control. Reassigning to the other
  position swaps again.
- The original pre-swap "which was main" is intentionally **not** retained.
_Avoid_: track, discipline collection (it is just a `Position` value + a mentor).

**Specialization mentor**:
The single mentor an intern is paired with 1-on-1 for their specialization. Stored in the
existing `InternProfile.secondaryMentor` field; must differ from `primaryMentor`. **Written only
by an admin as part of assigning a specialization** — single writer, single meaning. The
invite/registration flow no longer sets this field (its picker is removed). Legacy invite-set
values are meaningless without a `specializationAssignedAt` and should be treated as "no
specialization" (see ADR 0002).
_Avoid_: co-mentor, area mentor, second mentor (it is *the specialization mentor*, nothing else).

> **Naming trap:** In this org's everyday speech, "admin" = the *main mentor* / program leader
> (the platform **admin** role), and "mentor" usually means the *specialization mentor* (the
> `secondaryMentor`). In code and docs use the platform-role words: **admin** assigns, the
> **specialization mentor** is assigned.
