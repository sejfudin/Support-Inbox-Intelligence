import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * One intern's open tickets, split across the four workload segments the server
 * always returns in canonical order (To do / In progress / On staging / Blocked).
 *
 * Segments are fixed-width so every row in the table lines up into columns, and
 * a zero count stays as an empty slot rather than collapsing — otherwise rows
 * would each have a different number of pills and the table would read as ragged
 * noise. A filled segment is a solid block of the status colour with white text;
 * an empty one is a flat neutral slot with no glyph, so the eye reads the row's
 * load from the colour blocks alone.
 */
export function WorkloadSegments({ workload = [] }) {
  if (workload.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <div className="flex items-center gap-1">
      {workload.map((segment) => {
        const isEmpty = segment.count === 0;

        const slot = (
          <span
            className={cn(
              // Rectangles, not pills: a wide, shallow 40×18 block with a 4px
              // radius, matching the mockup's segmented workload bar.
              'inline-flex h-[1.125rem] w-10 items-center justify-center rounded text-[11px] font-semibold leading-none tabular-nums',
              isEmpty ? 'bg-muted/50' : 'text-white'
            )}
            style={isEmpty ? undefined : { backgroundColor: segment.color }}
          >
            {isEmpty ? '' : segment.count}
          </span>
        );

        // An empty slot carries no information a tooltip could add, and wrapping
        // all four keeps a hover target over dead space in every row.
        if (isEmpty) return <span key={segment.slug}>{slot}</span>;

        return (
          <Tooltip key={segment.slug}>
            <TooltipTrigger asChild>{slot}</TooltipTrigger>
            <TooltipContent>
              <p className="text-xs font-medium">
                {segment.count} {segment.label.toLowerCase()}
              </p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

/** The colour key under the table — same source of truth as the segments. */
export function WorkloadLegend({ buckets = [] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {buckets.map((bucket) => (
        <span
          key={bucket.slug}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
        >
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: bucket.color }}
            aria-hidden="true"
          />
          {bucket.label}
        </span>
      ))}
    </div>
  );
}
