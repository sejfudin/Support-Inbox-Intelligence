# Sprint progress is measured in story points, so a sprint requires estimates

## Status

accepted

## Context

`storyPoints` already exists on tickets — an integer 1–5, **optional, defaulting to null**, sortable,
and suggestible by the AI metadata service. Nothing has ever depended on it being present.

The sprint progress bar can measure either finished tickets or finished points. Ticket count is
always available and never wrong, but it treats a one-point copy fix and a five-point feature as
equal, so the bar moves fastest when the easy work is done first. Points measure delivered effort,
which is the number a team plans against and the only basis on which velocity across sprints means
anything later.

Points have one hazard, and it comes straight from that `null` default: an unestimated ticket is
worth zero. A sprint of unestimated work sits at 0% while the team finishes all of it, and any
unestimated ticket left undone caps the sprint below 100% forever. Adding an estimate mid-sprint
moves the bar without any work happening.

Three ways to handle unestimated tickets were considered: count them as zero (a confidently wrong
number), exclude them from the calculation (honest about estimated work, silent about the rest), or
refuse to let them into a sprint at all.

## Decision

**Progress is the sum of done story points over the sum of all story points in the sprint. A ticket
must carry an estimate before it can be added to a sprint.**

- The estimate requirement is enforced wherever a ticket enters a sprint, not only in the modal's
  drag interaction.
- Tickets split three ways for the bar: **done** is an `isDone` status, **to do** is the first main
  status, and **in progress** is everything in between — so a ticket on staging or carrying a blocker
  reads as in progress rather than untouched.
- **Archived tickets keep their sprint but are excluded from every count**, numerator and denominator
  alike, so cancelled work never holds a sprint below 100%.
- Ticket counts are still displayed beside the points; they are just not what the bar measures.

## Consequences

- Estimating becomes mandatory at exactly one moment — sprint planning — rather than optional
  everywhere and therefore skipped. The AI suggestion path makes it roughly one click, but it is
  friction on the feature's main interaction, and it is deliberate.
- Tickets created and worked outside a sprint still need no estimate. The requirement is a property
  of sprint membership, not of tickets.
- The 1–5 range was set for a field nothing depended on. Points now carry weight, so that ceiling —
  and whether a five-point ticket should be split instead — is worth revisiting on its own.
- Velocity across sprints becomes computable for free, because every sprinted ticket is estimated.
  That is the intended payoff and the main reason estimates are required rather than optional.
- Reversing to a count-based bar is a one-line change to the aggregation, but the estimates gathered
  in the meantime stay useful, so the reversal is genuinely cheap.
