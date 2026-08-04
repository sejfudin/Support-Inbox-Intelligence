import { Link } from 'react-router-dom';
import { ArrowRight, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/Avatar';
import { AttendanceMeter } from './AttendanceMeter';
import { WorkloadSegments, WorkloadLegend } from './WorkloadSegments';

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

        <Link
          to="/admin/users"
          data-test="admin-dashboard-manage-team-link"
          className="group inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          Manage team
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
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
                  <tr key={intern.id} className="border-t border-border/50">
                    <td className="px-1 py-2.5 align-middle">
                      <div className="flex items-center gap-2.5">
                        <Avatar users={[{ ...intern, _id: intern.id, role: 'intern' }]} size="sm" />
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-semibold leading-4 text-foreground">
                            {intern.fullname}
                          </div>
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

          <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <span className="text-[11px] text-muted-foreground">
                {interns.length} {interns.length === 1 ? 'intern' : 'interns'} in this workspace
              </span>
              <WorkloadLegend buckets={workloadBuckets} />
            </div>
            <Link
              to="/admin/users"
              className="group inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Add intern
            </Link>
          </footer>
        </>
      ) : (
        /* Centred in the panel's spare height rather than stretched to fill it: a
           dashed border blown up to the panel's full height reads as a broken
           container instead of an empty state. */
        <div className="mt-4 flex min-h-0 flex-1 items-center justify-center">
          <div className="w-full rounded-2xl border border-dashed border-border px-4 py-10 text-center">
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
