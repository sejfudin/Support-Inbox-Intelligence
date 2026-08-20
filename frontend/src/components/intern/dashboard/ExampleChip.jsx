/**
 * Marks a card that is showing example data during the what's-new tour.
 *
 * Not optional decoration. These cards carry someone's own performance record —
 * an evaluation average, a placement decision — and a fabricated one presented
 * without a label is alarming rather than instructive. Every card that renders
 * `tourPreview` sample data must render this too.
 */
export function ExampleChip() {
  return (
    <span className="shrink-0 rounded-full bg-[hsl(var(--tone-warning)/0.15)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[hsl(var(--tone-warning-fg))]">
      Example
    </span>
  );
}
