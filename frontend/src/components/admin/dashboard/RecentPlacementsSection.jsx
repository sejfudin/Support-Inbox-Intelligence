import { format } from 'date-fns';
import { getAvatarColor } from '@/helpers/avatarColor';
import { getInitials } from '@/helpers/getInitials';
import { DashboardCardEmpty, DashboardCardHeader } from './DashboardCard';

/**
 * One half of `PlacementsSpecializationCard` — no panel of its own, the parent
 * card owns the surface and the divider between the halves.
 */
export function RecentPlacementsSection({ placements = [] }) {
  return (
    <>
      <DashboardCardHeader kicker="Recent placements" />

      {/* The empty copy is platform-wide, like the list itself — see
          `loadPlacements()` in server/services/adminDashboardService.js. */}
      <div className="mt-3 flex min-h-0 flex-1 flex-col">
        {placements.length === 0 ? (
          <DashboardCardEmpty>No interns have been placed on the platform yet.</DashboardCardEmpty>
        ) : (
          <ul className="-mx-1 space-y-1">
            {placements.map((placement) => (
              <li key={placement.id} className="flex items-center gap-2.5 rounded-xl px-1 py-1.5">
                <span
                  className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${getAvatarColor(placement.intern?.fullname || '?')}`}
                  aria-hidden="true"
                >
                  {getInitials(placement.intern?.fullname || '?')}
                </span>

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
