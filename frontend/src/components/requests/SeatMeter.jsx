import { cn } from '@/lib/utils';

// Above this many seats, one segment per seat becomes a row of slivers — fall
// back to a plain two-tier bar so the proportions still read.
const MAX_SEGMENTS = 14;

/**
 * The seat counts, drawn. `wanted` segments, of which `placed` are filled and
 * `inSelection` still have someone live against them.
 *
 * The segments show the live picture — placed, then still-being-decided, then
 * empty — while `putForward` stays out of the bar entirely. That split is the
 * point: `putForward` counts every intern ever offered here, including the ones
 * since closed out, so drawing it as occupied seats would show a full request
 * whose candidates are all finished. It is a record of effort spent;
 * `inSelection` is the one that says whether anyone is still coming.
 *
 * `staged` is a fourth state, never folded into the others: nobody has been
 * offered a staged pick yet, and a meter that counted them as put forward would
 * tell the admin the work was already sent.
 *
 * The app-native twin of `symphony/requests/RequestSeatMeter` — same arithmetic,
 * drawn with app tone tokens instead of the symphony surface's, so it reads
 * correctly in all eleven themes and in dark mode.
 */
export function SeatMeter({
  wanted,
  putForward,
  inSelection,
  placed,
  staged = 0,
  className,
  segmentClassName,
}) {
  const safeWanted = Math.max(0, wanted ?? 0);
  const safePlaced = Math.max(0, placed ?? 0);
  const safeInSelection = Math.max(0, inSelection ?? 0);
  const safeForward = Math.max(safePlaced, putForward ?? 0);
  const safeStaged = Math.max(0, staged ?? 0);

  const placedSeats = Math.min(safePlaced, safeWanted);
  const liveSeats = Math.min(safeInSelection, safeWanted - placedSeats);
  const stagedSeats = Math.min(safeStaged, safeWanted - placedSeats - liveSeats);
  const emptySeats = Math.max(0, safeWanted - placedSeats - liveSeats - stagedSeats);

  // One sentence, because the segment colours alone don't carry this — and it is
  // the only form of the breakdown a screen reader gets.
  const label = `${safePlaced} placed, ${safeInSelection} in selection, ${safeForward} put forward${
    safeStaged > 0 ? `, ${safeStaged} staged` : ''
  }, of ${safeWanted} ${safeWanted === 1 ? 'seat' : 'seats'}`;

  const pct = (value) => (safeWanted === 0 ? 0 : (value / safeWanted) * 100);
  const segment = 'h-[3px] flex-1 rounded-full';

  if (safeWanted > MAX_SEGMENTS) {
    return (
      <div
        className={cn('flex h-[3px] w-full overflow-hidden rounded-full bg-muted', className)}
        role="img"
        aria-label={label}
      >
        <div
          className="h-full bg-[hsl(var(--tone-success))]"
          style={{ width: `${pct(placedSeats)}%` }}
        />
        <div className="h-full bg-primary/60" style={{ width: `${pct(liveSeats)}%` }} />
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-1', className)} role="img" aria-label={label}>
      {Array.from({ length: placedSeats }, (_unused, index) => (
        <span
          key={`placed-${index}`}
          className={cn(segment, 'bg-[hsl(var(--tone-success))]', segmentClassName)}
        />
      ))}
      {Array.from({ length: liveSeats }, (_unused, index) => (
        <span key={`live-${index}`} className={cn(segment, 'bg-primary', segmentClassName)} />
      ))}
      {Array.from({ length: stagedSeats }, (_unused, index) => (
        <span key={`staged-${index}`} className={cn(segment, 'bg-primary/40', segmentClassName)} />
      ))}
      {Array.from({ length: emptySeats }, (_unused, index) => (
        <span
          key={`empty-${index}`}
          className={cn(segment, 'bg-muted-foreground/20', segmentClassName)}
        />
      ))}
    </div>
  );
}
