import { Link } from 'react-router-dom';
import { ChartPie, AlignLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DashboardCard, DashboardCardEmpty } from '@/components/dashboard/DashboardCard';
import { useStoredPreference } from '@/hooks/useStoredPreference';
import { ExampleChip } from './ExampleChip';
import { WorkloadBar } from './WorkloadBar';
import { WorkloadDonut } from './WorkloadDonut';
import { ticketsPathForStatus } from './workloadLink';

// Which view the card opens on, remembered per browser profile (see
// `hooks/useStoredPreference.js`). Not an account preference: it is one card's
// toggle rather than a Settings row, so it is deliberately absent from the
// tables in `context/ThemeConfigContext.jsx` and never reaches the server. The
// two views answer different questions — the bar reads "how loaded am I", the
// donut "what is the mix" — and which one an intern prefers is stable, not a
// per-visit decision.
const VIEW_STORAGE_KEY = 'intern-dashboard:workload-view';
const VIEWS = [
  { id: 'bar', label: 'Bar', icon: AlignLeft },
  { id: 'donut', label: 'Breakdown', icon: ChartPie },
];
const isValidView = (value) => VIEWS.some((view) => view.id === value);

/** Two-way segmented control, sized to sit in a card header beside the count. */
function ViewToggle({ view, onChange }) {
  return (
    // relative z-10 lifts the toggle above the card's stretched link, so
    // switching views doesn't navigate to the ticket list.
    <div
      className="relative z-10 inline-flex shrink-0 rounded-[var(--r-control)] bg-muted/70 p-0.5"
      role="group"
    >
      {VIEWS.map(({ id, label, icon: Icon }) => (
        <Tooltip key={id}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => onChange(id)}
              aria-label={`${label} view`}
              aria-pressed={view === id}
              data-test={`intern-dashboard-workload-view-${id}`}
              className={cn(
                'inline-flex h-6 w-6 items-center justify-center rounded-[0.3rem] transition-colors',
                view === id
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs font-medium">{label}</p>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

/**
 * The intern's own open tickets, as a proportional bar or as a donut.
 *
 * No link out at the bottom — "My tickets" sits directly below this card with
 * its own "View all", and a second link here only bought a block of dead space
 * between the legend and the card's edge.
 */
export function MyWorkloadCard({ workload, isPreview = false }) {
  const [view, setView] = useStoredPreference(VIEW_STORAGE_KEY, 'bar', isValidView);

  const buckets = workload?.buckets || [];
  const open = workload?.open ?? 0;

  return (
    <DashboardCard
      title="My workload"
      // No card-wide hover tint any more: the card is not a single click target, so
      // lighting the whole panel would promise something it no longer does. The
      // legend rows carry their own hover.
      className="group relative"
      action={
        <div className="flex shrink-0 items-center gap-2.5">
          {isPreview && <ExampleChip />}
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {open}
            <span className="ml-1 text-[11px] font-medium text-muted-foreground">open</span>
          </span>
          {open > 0 && <ViewToggle view={view} onChange={setView} />}
        </div>
      }
      data-tour="intern-dashboard-workload"
    >
      {/* No stretched card-wide link. It used to cover the whole panel and open
          "all my tickets", which meant every click anywhere landed on it — including
          clicks meant for a single status. The legend rows are the click targets
          now, one per status, so the card itself is inert. */}

      {open === 0 ? (
        <DashboardCardEmpty>
          Nothing open right now — anything assigned to you will show up here.
        </DashboardCardEmpty>
      ) : view === 'donut' ? (
        <WorkloadDonut buckets={buckets} />
      ) : (
        <>
          {/* The bar floats in the space above the legend rather than sitting
              flush under the title. The card's height is set by the attendance
              hero beside it, and top-packing the content collected all of that
              spare height into one dead block at the bottom. */}
          {/* `relative z-10`, like the donut view: the bar's segments are their own
              links now, so they have to sit above the stretched card link. */}
          <div className="relative z-10 flex flex-1 items-center">
            <WorkloadBar buckets={buckets} />
          </div>

          {/* mt-auto, matching the donut view — the status list sits on the
              card's bottom edge in both, so toggling doesn't move the rows. */}
          <ul className="mt-auto space-y-1 pt-4">
            {buckets.map((bucket) => (
              <li key={bucket.slug}>
                {/* Same destination as the bar segment above and as the donut
                    view's legend — one status, my tickets. */}
                <Link
                  to={ticketsPathForStatus(bucket.slug)}
                  aria-label={`${bucket.count} ${bucket.label} — open in my tickets`}
                  className={cn(
                    'flex items-center gap-2 rounded-[var(--r-control)] px-1.5 py-0.5 text-[13px] transition-colors',
                    'hover:bg-muted/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
                    bucket.count === 0 && 'opacity-45'
                  )}
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: bucket.color }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {bucket.label}
                  </span>
                  <span
                    className={cn(
                      'shrink-0 font-semibold tabular-nums',
                      // Blocked is the one count that is bad news rather than just
                      // a number, so it carries its status colour into the total.
                      bucket.slug === 'blocked' && bucket.count > 0
                        ? 'text-[hsl(var(--tone-danger-fg))]'
                        : 'text-foreground'
                    )}
                  >
                    {bucket.count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </DashboardCard>
  );
}
