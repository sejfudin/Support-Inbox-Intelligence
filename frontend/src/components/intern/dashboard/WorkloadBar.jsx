import { Link } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ticketsPathForStatus } from './workloadLink';

/**
 * One person's open tickets as a single proportional bar.
 *
 * Deliberately NOT `components/dashboard/WorkloadSegments` — that one draws four
 * fixed-width numbered blocks so every row of the admin's roster table lines up
 * into columns. This is one person on their own card, with no rows to align
 * against, so the bar can spend its full width saying *proportion* instead. The
 * counts are read off the legend underneath, which is why the segments carry no
 * numerals: printing them twice makes the bar look like a table.
 *
 * Segments come from the server in canonical order with the workspace's own
 * status colours, the same source the legend uses.
 */
export function WorkloadBar({ buckets = [] }) {
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);

  if (total === 0) {
    return <div className="h-2.5 w-full rounded-full bg-muted" aria-hidden="true" />;
  }

  return (
    <div
      className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full"
      role="img"
      aria-label={buckets
        .filter((bucket) => bucket.count > 0)
        .map((bucket) => `${bucket.count} ${bucket.label.toLowerCase()}`)
        .join(', ')}
    >
      {buckets
        .filter((bucket) => bucket.count > 0)
        .map((bucket) => (
          <Tooltip key={bucket.slug}>
            <TooltipTrigger asChild>
              {/* Each segment opens that status in my tickets, same destination as
                  the legend row beneath it. `tabIndex={-1}` on purpose: the legend
                  already gives every status a keyboard-reachable link, and the bar
                  is the same set of targets a second time. */}
              <Link
                to={ticketsPathForStatus(bucket.slug)}
                tabIndex={-1}
                aria-hidden="true"
                // A single-ticket segment of a large total would round to a
                // hairline, so every present segment keeps a visible minimum and
                // the rest of the width is shared out proportionally.
                className="h-full min-w-[0.5rem] cursor-pointer rounded-[var(--r-tile)] transition-all hover:brightness-110"
                style={{
                  backgroundColor: bucket.color,
                  flexGrow: bucket.count,
                  flexBasis: 0,
                }}
              />
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs font-medium">
                {bucket.count} {bucket.label.toLowerCase()}
              </p>
            </TooltipContent>
          </Tooltip>
        ))}
    </div>
  );
}
