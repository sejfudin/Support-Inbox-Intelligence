import { format } from 'date-fns';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getAvatarColor } from '@/helpers/avatarColor';
import { getInitials } from '@/helpers/getInitials';
import { DashboardCardEmpty, DashboardCardHeader, DashboardCardHelp } from './DashboardCard';

/**
 * One half of `PlacementsSpecializationCard` — no panel of its own, the parent
 * card owns the surface and the divider between the halves.
 *
 * The three most recently assigned specializations, platform-wide like the
 * placements half beside it — see `loadSpecializations()` in
 * server/services/adminDashboardService.js.
 */
export function SpecializationAssignedSection({ specializations = [] }) {
  return (
    <>
      <DashboardCardHeader
        kicker="Specialization assigned"
        action={
          <DashboardCardHelp label="specialization assignments">
            The last three interns given a specialization, newest first — the position that was
            confirmed as their focus, and the mentor they were paired with 1-on-1. Platform-wide,
            not just this workspace.
          </DashboardCardHelp>
        }
      />

      <div className="mt-3 flex min-h-0 flex-1 flex-col">
        {specializations.length === 0 ? (
          <DashboardCardEmpty>No specializations have been assigned yet.</DashboardCardEmpty>
        ) : (
          <ul className="-mx-1 space-y-1">
            {specializations.map((row) => (
              <li key={row.id} className="flex items-center gap-2.5 rounded-xl px-1 py-1.5">
                <span
                  className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${getAvatarColor(row.intern?.fullname || '?')}`}
                  aria-hidden="true"
                >
                  {getInitials(row.intern?.fullname || '?')}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold leading-4 text-foreground">
                    {row.intern?.fullname}
                  </span>
                  <span className="block truncate text-[11px] leading-4 text-muted-foreground">
                    {/* "Mentor <name>", never "2nd <name>" — on /specialization `2nd:`
                        labels the intern's secondary *position*, so reusing it for the
                        mentor here would mean two different things on two admin screens. */}
                    {[row.specialization, row.secondaryMentor && `Mentor ${row.secondaryMentor}`]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>

                {row.assignedAt && (
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    {format(new Date(row.assignedAt), 'MMM d')}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* Kept outside the empty/list branch on purpose: with nothing assigned yet
            this is the way *to* assign one, so it is the more useful of the two
            states to offer it in. `/specialization` is admin-only, and so is this
            whole dashboard, so the link can never point somewhere the reader is
            bounced from. */}
        <Link
          to="/specialization"
          data-test="admin-dashboard-specializations-link"
          className="group mt-auto inline-flex shrink-0 items-center gap-1.5 self-start pt-3 text-xs font-semibold text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          View all specializations
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </>
  );
}
