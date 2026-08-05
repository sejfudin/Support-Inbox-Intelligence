import {
  DashboardCard,
  DashboardCardEmpty,
  DashboardCardHelp,
} from '@/components/dashboard/DashboardCard';

export function LastPlacementCard({ lastPlacement }) {
  // Null when the placement carries no decided-at date at all (nothing to date it
  // by, not even `updatedAt`) — the number is dropped rather than rendered as a
  // bare "days ago" with nothing in front of it.
  const daysAgo = Number.isFinite(lastPlacement?.daysAgo) ? lastPlacement.daysAgo : null;

  const fullname = lastPlacement?.intern?.fullname?.trim() || '';

  return (
    <DashboardCard
      kicker="Last intern placed"
      action={
        <DashboardCardHelp label="About last intern placed">
          Platform-wide, not just this workspace: placement is a programme milestone, so this counts
          the most recent placement across every workspace.
        </DashboardCardHelp>
      }
      className="min-h-0 flex-1"
      contentClassName="justify-between"
    >
      {lastPlacement ? (
        <>
          {/* Number and unit on one line — the two never break apart, so the card
              reads as "7 days ago" rather than a bare numeral with its unit
              orphaned on the line below. */}
          <p className="flex flex-wrap items-baseline gap-x-1.5">
            <span className="text-4xl font-semibold leading-none tabular-nums text-foreground">
              {daysAgo === null ? '—' : daysAgo === 0 ? 'Today' : daysAgo}
            </span>
            {daysAgo !== null && daysAgo !== 0 && (
              <span className="text-sm font-medium text-muted-foreground">
                {daysAgo === 1 ? 'day ago' : 'days ago'}
              </span>
            )}
          </p>
          <div className="mt-3 min-w-0">
            <p className="truncate text-xs font-semibold leading-4 text-foreground">{fullname}</p>
            {lastPlacement.dayOfCycle && (
              <p className="truncate text-[11px] leading-4 text-muted-foreground">
                day {lastPlacement.dayOfCycle} of cycle
              </p>
            )}
          </div>
        </>
      ) : (
        <DashboardCardEmpty>No interns have been placed on the platform yet.</DashboardCardEmpty>
      )}
    </DashboardCard>
  );
}
