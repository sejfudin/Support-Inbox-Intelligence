import { cn } from '@/lib/utils';
import { getRequestTotals } from '@/helpers/staffingRequests';
import { getNeededBy } from './requestPresentation';

const Tile = ({ label, value, sub, tone }) => (
  <div className="min-w-0 flex-1 px-4 py-3 first:pl-0 last:pr-0">
    {/* Deliberately NOT `symphony-dashboard-stat-label`: that class is for the
        dark brand KPI panel and hardcodes white text, which is invisible here. */}
    <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
      {label}
    </p>
    <p
      className={cn(
        'mt-1 truncate text-xl font-bold text-foreground',
        tone === 'danger' && 'text-[hsl(var(--tone-danger-fg))]'
      )}
    >
      {value}
    </p>
    {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
  </div>
);

/**
 * `wanted` split into its three downstream counts, then the date. They are
 * separate tiles on purpose — a single "6 of 8" cannot say which of them it
 * means, and each leads to a different action. In selection is the one that
 * says whether anyone is still coming: put forward counts everyone ever offered
 * here, so it reads the same whether six people are interviewing or all six
 * were closed out.
 *
 * There is no "Seats asked for" tile: `wanted` is the denominator of two tiles
 * already, so a third one repeating it bare said nothing the row didn't.
 */
export function RequestStatStrip({ request }) {
  const totals = getRequestTotals(request);
  const neededBy = getNeededBy(request);
  const surplus = Math.max(0, totals.putForward - totals.wanted);

  return (
    <div className="flex flex-wrap divide-x divide-border/60 border-y border-border/60 py-1">
      <Tile
        label="Put forward"
        value={`${totals.putForward} of ${totals.wanted}`}
        sub={surplus > 0 ? `${surplus} more than asked for` : undefined}
      />
      <Tile
        label="In selection"
        value={totals.inSelection}
        sub={
          totals.inSelection === 0 && totals.putForward > 0
            ? 'nobody still being considered'
            : undefined
        }
      />
      <Tile
        label="Placed"
        value={`${totals.placed} of ${totals.wanted}`}
        sub={
          totals.placed < totals.wanted
            ? `${totals.wanted - totals.placed} still open`
            : 'all seats filled'
        }
      />
      <Tile
        label="Needed by"
        value={neededBy.missing ? '—' : neededBy.text}
        sub={neededBy.missing ? 'no date given' : neededBy.sub}
        tone={neededBy.overdue ? 'danger' : undefined}
      />
    </div>
  );
}
