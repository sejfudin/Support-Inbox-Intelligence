import { format } from 'date-fns';
import {
  DashboardCardEmpty,
  DashboardCardHeader,
  DashboardCardHelp,
} from '@/components/dashboard/DashboardCard';
import { UserAvatar } from '@/components/ui/user-avatar';

/**
 * One half of `PlacementsSpecializationCard` — no panel of its own, the parent
 * card owns the surface and the divider between the halves.
 */
export function RecentPlacementsSection({ placements = [] }) {
  return (
    <>
      <DashboardCardHeader
        kicker="Recent placements"
        action={
          <DashboardCardHelp label="About recent placements">
            The last three interns placed on a project, newest first — with the project, the
            position they were placed into, and how far into their internship it happened.
            Platform-wide, not just this workspace: placement is a programme milestone.
          </DashboardCardHelp>
        }
      />

      {/* The empty copy is platform-wide, like the list itself — see
          `loadPlacements()` in server/services/adminDashboardService.js. */}
      <div className="mt-3 flex min-h-0 flex-1 flex-col">
        {placements.length === 0 ? (
          <DashboardCardEmpty>No interns have been placed on the platform yet.</DashboardCardEmpty>
        ) : (
          <ul className="-mx-1 space-y-1">
            {placements.map((placement) => (
              <li key={placement.id} className="flex items-center gap-2.5 rounded-xl px-1 py-1.5">
                <UserAvatar
                  user={placement.intern}
                  name={placement.intern?.fullname || '?'}
                  className="h-8 w-8 text-[11px]"
                  showTitle={false}
                />

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold leading-4 text-foreground">
                    {placement.intern?.fullname}
                  </span>
                  <span className="block truncate text-[11px] leading-4 text-muted-foreground">
                    {[placement.project, placement.position].filter(Boolean).join(' · ')}
                    {placement.decidedAt
                      ? ` · ${format(new Date(placement.decidedAt), 'MMM d')}`
                      : ''}
                  </span>
                </span>

                {placement.dayOfCycle && (
                  <span className="shrink-0 text-[11px] font-semibold tabular-nums text-muted-foreground">
                    Day {placement.dayOfCycle}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
