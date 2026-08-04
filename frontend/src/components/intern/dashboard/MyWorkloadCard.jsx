import { Link } from 'react-router-dom';
import { ChartPie, AlignLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DashboardCard, DashboardCardEmpty } from '@/components/dashboard/DashboardCard';
import { useStoredPreference } from '@/hooks/useStoredPreference';
import { ExampleChip } from './ExampleChip';
import { WorkloadBar } from './WorkloadBar';
import { WorkloadDonut } from './WorkloadDonut';

// Which view the card opens on, remembered per browser profile the same way the
// colour theme is (see `hooks/useStoredPreference.js`). The two answer different
// questions — the bar reads "how loaded am I", the donut "what is the mix" — and
// which one an intern prefers is stable, not a per-visit decision.
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
    <div className="relative z-10 inline-flex shrink-0 rounded-lg bg-muted/70 p-0.5" role="group">
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
      className="group relative transition-colors hover:bg-muted/25"
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
      {/* Stretched link: the whole card opens the filtered ticket list, but the
          card stays a <section> so the view toggle isn't an interactive element
          nested inside an anchor. Everything that needs its own click target is
          lifted above this with `relative z-10`; the chart and legend sit under
          it deliberately, since their only interaction is hover. */}
      <Link
        to="/tickets?assignee=me"
        aria-label="Open my tickets"
        data-test="intern-dashboard-workload-link"
        className="absolute inset-0 rounded-[1.25rem] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/50"
      />

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
          <div className="flex flex-1 items-center">
            <WorkloadBar buckets={buckets} />
          </div>

          {/* mt-auto, matching the donut view — the status list sits on the
              card's bottom edge in both, so toggling doesn't move the rows. */}
          <ul className="mt-auto space-y-2 pt-4">
            {buckets.map((bucket) => (
              <li key={bucket.slug} className="flex items-center gap-2 text-[13px]">
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
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-foreground'
                  )}
                >
                  {bucket.count}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </DashboardCard>
  );
}
