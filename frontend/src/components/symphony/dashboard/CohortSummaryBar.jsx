import { SymphonyCard } from '@/components/symphony/SymphonyCard';

// Colours mirror the KPI card dots (Available / In Selection / Placed) so the bar
// and the cards read as one system; "Not project-ready" gets its own amber.
const SEGMENTS = [
  { key: 'notReady', label: 'Not project-ready', color: '#E0A93B' },
  { key: 'available', label: 'Available', color: '#726BFF' },
  { key: 'inPipeline', label: 'In Selection', color: '#5B7CFA' },
  { key: 'placed', label: 'Placed', color: '#E88AA6' },
];

export function CohortSummaryBar({ isPending, funnel, summary }) {
  const available = summary?.readyWithoutActiveRecommendation ?? 0;
  const inPipeline = summary?.activeRecommendations ?? 0;
  const placed = funnel?.placed ?? 0;
  // Everyone currently in the programme: onboarding + ready + placed (excludes
  // completed and discontinued). Onboarding is taken as the remainder so the
  // four segments always sum exactly to the total, even if an onboarding intern
  // is somehow already in selection.
  const total = (funnel?.active ?? 0) + (funnel?.ready ?? 0) + placed;
  const notReady = Math.max(0, total - available - inPipeline - placed);

  const counts = { notReady, available, inPipeline, placed };
  const withValue = SEGMENTS.filter((segment) => counts[segment.key] > 0);

  return (
    <SymphonyCard variant="muted" className="p-5 sm:p-6">
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold tabular-nums text-foreground">
          {isPending ? '—' : total}
        </span>
        <span className="text-sm font-medium text-muted-foreground">interns in the programme</span>
      </div>

      {!isPending && total > 0 && (
        <>
          <div className="mt-4 flex h-2.5 gap-1">
            {withValue.map((segment) => (
              <div
                key={segment.key}
                className="rounded-full"
                style={{ flexGrow: counts[segment.key], backgroundColor: segment.color }}
              />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
            {SEGMENTS.map((segment) => (
              <span
                key={segment.key}
                className="flex items-center gap-2 text-[13px] text-foreground/80"
              >
                <span
                  className="h-[9px] w-[9px] rounded-[3px]"
                  style={{ backgroundColor: segment.color }}
                />
                <span className="font-semibold text-foreground">{counts[segment.key]}</span>
                {segment.label}
              </span>
            ))}
          </div>
        </>
      )}
    </SymphonyCard>
  );
}
