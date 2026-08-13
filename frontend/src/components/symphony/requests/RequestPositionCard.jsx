import { CheckCircle2, ChevronDown, CircleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TechnologyIcon } from '@/helpers/technologyIcons';
import { RequestSeatMeter } from './RequestSeatMeter';

/**
 * The card chrome both sides of a requested position wear: the collapsible
 * header, the marker, the discipline and its technologies, the one-line summary,
 * the seat meter, and the chevron. The roster underneath is the caller's.
 *
 * Extracted because leadership's `RequestPositionGroup` and the admin's
 * `AdminRequestSeatGroup` are the same object seen from two sides, and every
 * pixel of the header above the fold was duplicated between them — including the
 * chevron button, byte for byte. A header fix used to mean two edits, and the
 * two copies had already begun to drift.
 *
 * What is deliberately NOT shared, and stays a prop:
 * - `summary`. The wording differs per side on purpose — leadership reads "2 in
 *   selection", the admin reads "2 awaiting leadership" and counts staged picks
 *   this side has never been told about. Unifying the string would merge copy
 *   that was chosen, not copied.
 * - `action`. The admin's `Add candidates` lives in the header because it is the
 *   point of the card; leadership's pane writes nothing and passes none.
 * - `children`. Who is on the position, who is missing, and — on the admin's
 *   side — who is staged. Different cards, different grid.
 *
 * The marker IS derived here: "filled" and "waiting on a decision" mean the same
 * thing to both sides, and a position nobody has started carries neither, since
 * there is nothing to flag about untouched work.
 */
export function RequestPositionCard({
  row,
  summary,
  expanded,
  onExpandedChange,
  staged = 0,
  technologyIndex,
  action = null,
  className,
  children,
}) {
  const technologies = row.technologies ?? [];
  const isFilled = row.placed >= row.wanted && row.wanted > 0;

  const marker = isFilled
    ? { Icon: CheckCircle2, className: 'text-[hsl(var(--symphony-placed))]' }
    : row.inSelection > 0
      ? { Icon: CircleAlert, className: 'text-amber-600 dark:text-amber-400' }
      : null;

  return (
    <section
      className={cn('symphony-card-muted overflow-hidden', className)}
      data-test={`position-group-${row.id}`}
    >
      <div className="flex items-center gap-3 p-4">
        <h3 className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onExpandedChange(!expanded)}
            aria-expanded={expanded}
            className="group flex w-full items-center gap-3 text-left"
            data-test={`position-toggle-${row.id}`}
          >
            {/* The empty span holds the marker's place, so a position with no
                state to flag doesn't sit 20px left of its neighbours. */}
            {marker ? (
              <marker.Icon
                className={cn('h-5 w-5 shrink-0', marker.className)}
                aria-hidden="true"
              />
            ) : (
              <span className="h-5 w-5 shrink-0" aria-hidden="true" />
            )}

            <span className="min-w-0 flex-1 space-y-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-semibold text-foreground group-hover:underline">
                  {row.name}
                </span>
                {/* The brief, at header level, so a collapsed card still says
                    which discipline it is — that is what the pane is scanned
                    for. Icons only where the caller supplied an index to look
                    them up in; leadership's pane doesn't load one. */}
                {technologies.map((name) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[0.6875rem] text-muted-foreground"
                  >
                    {technologyIndex && (
                      <TechnologyIcon
                        technology={technologyIndex.get(name.toLowerCase())}
                        size={11}
                        className="shrink-0"
                      />
                    )}
                    {name}
                  </span>
                ))}
              </span>
              <span className="block truncate text-xs text-muted-foreground">{summary}</span>
            </span>
          </button>
        </h3>

        {action}

        <RequestSeatMeter
          wanted={row.wanted}
          putForward={row.putForward}
          inSelection={row.inSelection}
          placed={row.placed}
          staged={staged}
          showLabel={false}
          className="hidden w-20 shrink-0 sm:block"
        />

        {/* A second target for the same toggle: the header button is the
            accessible one, this is the one people aim at. */}
        <button
          type="button"
          onClick={() => onExpandedChange(!expanded)}
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Hide' : 'Show'} who is on ${row.name}`}
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          data-test={`position-chevron-${row.id}`}
        >
          <ChevronDown
            className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')}
            aria-hidden="true"
          />
        </button>
      </div>

      {expanded && <div className="border-t border-border/60 p-4">{children}</div>}
    </section>
  );
}
