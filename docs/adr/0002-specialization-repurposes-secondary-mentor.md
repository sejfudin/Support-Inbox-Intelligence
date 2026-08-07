# Specialization repurposes the secondaryMentor field

## Status

accepted

## Context

We are adding **specializations**: an admin (the program leader / "main mentor" in everyday
speech) confirms one of an intern's two declared positions as their focus and pairs them 1-on-1
with a dedicated mentor. The pairing is atomic — position + mentor set together in one admin
action — and marked by a new `InternProfile.specializationAssignedAt` timestamp.

The intern's 1-on-1 mentor needs to live somewhere. `InternProfile` already has a
`secondaryMentor` field, but today it means something different: it is set **at invite time**
by whoever registers the intern (`authService.register` → `createInternProfile`, with a picker
in the invite form). So "has a secondaryMentor" currently means "someone chose a second mentor
when inviting this intern" — not "this intern has a specialization."

We must decide where the specialization mentor is stored, because two meanings were competing
for one field.

Alternatives considered:

- **Add a new `specializationMentor` field**, leave invite-time `secondaryMentor` alone. No
  registration change, but two "second mentor" concepts coexist forever — a lasting source of
  confusion about which field means what.
- **Keep `secondaryMentor` dual-purpose** — invite sets an initial value, specialization
  overwrites it, the timestamp is the only marker. Least code, muddiest meaning; the field
  answers neither "who invited a second mentor" nor "who is the spec mentor" cleanly.

## Decision

**Repurpose `secondaryMentor` to mean exactly one thing: the specialization mentor.**

- The **only writer** is the admin's specialization assignment. `secondaryMentor` is set together
  with `specializationAssignedAt` and cleared together with it.
- The **invite/registration flow no longer sets `secondaryMentor`** — `secondaryMentorId` is
  removed from `authService.register` / `createInternProfile` and the picker is removed from the
  invite form.
- The **marker of a specialization is `specializationAssignedAt`, not the mentor field.** A
  `secondaryMentor` value without a timestamp does not indicate a specialization.
- Legacy interns whose `secondaryMentor` was set by the old invite flow have **no**
  `specializationAssignedAt`, so they correctly read as "not specialized." A backfill should null
  those stale values so the field's single meaning holds in the data too.

## Consequences

- `secondaryMentor` gains a single writer and a single meaning — read sites (`internService`
  mentor filters, `recommendationService`, `isAssignedMentor` access) keep working unchanged,
  now with a clearer contract.
- The invite flow loses a step (no second-mentor picker). Reversing this decision means
  reintroducing that picker and re-splitting the two meanings — meaningful cost, hence this ADR.
- Assigned-mentor access (view intern, notes/readiness/docs via `isAssignedMentor`) continues to
  flow from `secondaryMentor`. Evaluation rights are unchanged: evaluations remain admin-authored.
