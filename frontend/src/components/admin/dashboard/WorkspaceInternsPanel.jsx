import { Link, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/Avatar';
import { AttendanceMeter } from '@/components/dashboard/AttendanceMeter';
import { WorkloadSegments, WorkloadLegend } from '@/components/dashboard/WorkloadSegments';

/**
 * Where a row goes when clicked.
 *
 * `/user/:userId`, not `/my-interns/:userId` — the latter is guarded to MENTOR, so
 * an admin following it lands on a redirect. This mirrors the convention already in
 * `MentorRecommendationsPage`, `AdminUsersPage`, `SpecializationPage` and
 * `AdminStaffUserDetail`: admins reach a person through `/user/:userId`. This board
 * is admin-only, so there is no role branch to make here.
 */
const internProfilePath = (userId) => `/user/${userId}`;

/**
 * The workspace's interns with their open workload and this month's attendance.
 *
 * Scoped to interns still in the programme (active / ready) — a placed or
 * discontinued intern has no live workload to report, which is also why this
 * count can be lower than the workspace's total member count.
 */
export function WorkspaceInternsPanel({
  workspaceName,
  interns = [],
  workloadBuckets = [],
  className,
}) {
  const navigate = useNavigate();
  const hasInterns = interns.length > 0;

  return (
    <section
      className={cn('app-panel flex w-full flex-col p-4 sm:p-5', className)}
      data-tour="dashboard-interns"
      aria-label="Interns in this workspace"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold leading-6 text-foreground">Interns</h2>
            {workspaceName && (
              <span className="inline-flex max-w-full items-center gap-1.5 truncate rounded-full border border-primary/15 bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                {workspaceName}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Workload &amp; attendance for interns in this workspace
          </p>
        </div>

        {/* No "Manage team" link here, and no "Add intern" in the footer below.
            Both pointed at /admin/users, which the sidebar already reaches under
            Workspace Management — a board is for reading, and a second route into
            the same admin screen from a card header is duplicated navigation. */}
      </header>

      {hasInterns ? (
        <>
          {/* Grows with the rows — no vertical scroll. `flex-1` (without min-h-0, so
              it can never shrink below the table) absorbs any spare height when the
              right-hand rail is the taller column, which keeps the footer on the
              panel's bottom edge instead of floating under the last row. */}
          <div className="-mx-1 mt-4 min-w-0 flex-1 overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse">
              <thead>
                <tr className="text-left">
                  <th className="px-1 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Intern
                  </th>
                  <th className="px-1 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Workload
                  </th>
                  <th className="px-1 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Attendance
                  </th>
                </tr>
              </thead>
              <tbody>
                {interns.map((intern) => (
                  <tr
                    key={intern.id}
                    // The whole row is a click target for convenience, but the name
                    // below is a real `<Link>` so the row is reachable by keyboard and
                    // announced as a link — a bare `onClick` on `<tr>` is neither.
                    onClick={() => navigate(internProfilePath(intern.id))}
                    data-test={`admin-dashboard-intern-row-${intern.id}`}
                    className="cursor-pointer border-t border-border/50 transition-colors hover:bg-muted/40"
                  >
                    <td className="px-1 py-2.5 align-middle">
                      <div className="flex items-center gap-2.5">
                        <Avatar users={[{ ...intern, _id: intern.id, role: 'intern' }]} size="sm" />
                        <div className="min-w-0">
                          <Link
                            to={internProfilePath(intern.id)}
                            onClick={(event) => event.stopPropagation()}
                            className="block truncate text-[13px] font-semibold leading-4 text-foreground hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                          >
                            {intern.fullname}
                          </Link>
                          <div className="truncate text-[11px] leading-4 text-muted-foreground">
                            {intern.position || '—'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-1 py-2.5 align-middle">
                      <WorkloadSegments workload={intern.workload} />
                    </td>
                    <td className="w-[36%] px-1 py-2.5 align-middle">
                      <AttendanceMeter
                        rate={intern.attendanceRate}
                        presentDays={intern.presentDays}
                        workingDays={intern.workingDays}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <footer className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border/50 pt-3">
            <span className="text-[11px] text-muted-foreground">
              {interns.length} {interns.length === 1 ? 'intern' : 'interns'} in this workspace
            </span>
            <WorkloadLegend buckets={workloadBuckets} />
          </footer>
        </>
      ) : (
        /* Centred in the panel's spare height rather than stretched to fill it: a
           dashed border blown up to the panel's full height reads as a broken
           container instead of an empty state. */
        <div className="mt-4 flex min-h-0 flex-1 items-center justify-center">
          <div className="w-full rounded-[var(--r-card)] border border-dashed border-border px-4 py-10 text-center">
            <p className="text-sm font-medium text-foreground">No interns in this workspace</p>
            <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
              Only interns who are active members here and still in the programme appear — interns
              who were placed or completed are counted under placements instead.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
