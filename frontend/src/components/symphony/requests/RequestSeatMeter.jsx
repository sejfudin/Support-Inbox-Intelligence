import { cn } from '@/lib/utils';

// Above this many seats, one segment per seat becomes a row of slivers — fall
// back to a plain two-tier bar so the proportions still read.
const MAX_SEGMENTS = 14;

/**
 * The three counts, in one control: `wanted` seats, of which `putForward` have
 * someone suggested and `placed` actually took it. `placed` is a subset of
 * `putForward`, so the segments run solid → outlined → empty and never
 * double-count.
 *
 * Over-supply is real (an admin may suggest three people for two seats) and is
 * reported in the label rather than by drawing extra seats — the meter measures
 * demand, and demand doesn't grow because more names arrived.
 */
export function RequestSeatMeter({ wanted, putForward, placed, showLabel = true, className }) {
  const safeWanted = Math.max(0, wanted ?? 0);
  const safePlaced = Math.max(0, placed ?? 0);
  const safeForward = Math.max(safePlaced, putForward ?? 0);

  const placedSeats = Math.min(safePlaced, safeWanted);
  const forwardSeats = Math.min(safeForward, safeWanted) - placedSeats;
  const emptySeats = Math.max(0, safeWanted - placedSeats - forwardSeats);
  const surplus = Math.max(0, safeForward - safeWanted);

  // One sentence, because the segment colours alone don't carry this.
  const label = `${safePlaced} placed, ${safeForward} put forward, of ${safeWanted} ${
    safeWanted === 1 ? 'seat' : 'seats'
  }`;

  const asBar = safeWanted > MAX_SEGMENTS;
  const pct = (value) => (safeWanted === 0 ? 0 : (value / safeWanted) * 100);

  return (
    <div className={cn('space-y-1.5', className)}>
      {asBar ? (
        <div className="symphony-progress" role="img" aria-label={label}>
          <div className="flex h-full w-full">
            <div
              className="symphony-progress-placed h-full rounded-l-full"
              style={{ width: `${pct(placedSeats)}%` }}
            />
            <div
              className="h-full bg-[hsl(var(--symphony-brand)/0.45)]"
              style={{ width: `${pct(forwardSeats)}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="symphony-seats" role="img" aria-label={label}>
          {Array.from({ length: placedSeats }, (_unused, index) => (
            <span key={`placed-${index}`} className="symphony-seat symphony-seat-placed" />
          ))}
          {Array.from({ length: forwardSeats }, (_unused, index) => (
            <span key={`forward-${index}`} className="symphony-seat symphony-seat-forward" />
          ))}
          {Array.from({ length: emptySeats }, (_unused, index) => (
            <span key={`empty-${index}`} className="symphony-seat" />
          ))}
        </div>
      )}

      {showLabel && (
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{safePlaced} placed</span>
          {' · '}
          {safeForward} put forward of {safeWanted}
          {surplus > 0 && ` · ${surplus} more than asked for`}
        </p>
      )}
    </div>
  );
}
