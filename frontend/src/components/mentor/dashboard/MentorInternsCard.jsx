import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, UserRound } from 'lucide-react';
import { DashboardCard, DashboardCardEmpty } from '@/components/dashboard/DashboardCard';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useInterns } from '@/queries/interns';

// Kept low on purpose: this card has a fixed height budget on a page that
// never scrolls (see MentorDashboardPage) — more interns page through
// instead of growing the row count or the card.
const ROW_LIMIT = 4;

/**
 * The mentor's own interns — primary or secondary — same server-side scope
 * `MentorInternsPage.jsx` uses (`GET /api/interns` filters by
 * `primaryMentor`/`secondaryMentor` for a mentor caller), paged 4 at a time
 * with a link to the full, filterable list.
 *
 * Renders its own header rather than `DashboardCard`'s `title` prop (14px) —
 * matched to `QuickActionsCard`'s 16px header instead, since the two sit
 * beside each other on this board and a size mismatch there reads as
 * unfinished in a way it doesn't on the intern/admin boards, which never mix
 * the two header styles on one page.
 */
export function MentorInternsCard() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const { data, isPending, isError } = useInterns({ page, limit: ROW_LIMIT });
  const interns = data?.interns ?? [];
  const total = data?.pagination?.total ?? 0;
  const pages = data?.pagination?.pages ?? 0;

  return (
    <DashboardCard data-tour="mentor-dashboard-interns">
      <header>
        <h2 className="text-base font-semibold leading-6 text-foreground">My interns</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Primary or secondary — yours to guide
        </p>
      </header>

      <div className="mt-3 flex min-h-0 flex-1 flex-col">
        {isPending && (
          <ul className="space-y-3">
            {[0, 1, 2].map((row) => (
              <li key={row} className="flex items-center gap-2.5">
                <span className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-muted" />
                <span className="h-3 w-32 flex-1 animate-pulse rounded bg-muted" />
              </li>
            ))}
          </ul>
        )}

        {isError && <DashboardCardEmpty>Could not load your interns.</DashboardCardEmpty>}

        {!isPending && !isError && interns.length === 0 && (
          <DashboardCardEmpty>
            No interns assigned yet — you&apos;ll see them here once you&apos;re set as a primary or
            secondary mentor.
          </DashboardCardEmpty>
        )}

        {!isPending && !isError && interns.length > 0 && (
          <>
            <ul className="-mx-1.5 space-y-0.5">
              {interns.map((intern) => {
                const userId = intern.user?._id || intern.user;
                return (
                  <li key={intern._id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/my-interns/${userId}`)}
                      data-test={`mentor-dashboard-intern-row-${userId}`}
                      className="flex w-full items-center gap-2.5 rounded-[var(--r-control)] px-1.5 py-2 text-left transition-colors hover:bg-muted/40"
                    >
                      <UserAvatar
                        user={intern.user}
                        className="h-8 w-8 text-[11px]"
                        showTitle={false}
                        initials={<UserRound className="h-4 w-4" />}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold leading-4 text-foreground">
                          {intern.user?.fullname}
                        </span>
                        <span className="block truncate text-[11px] leading-4 text-muted-foreground">
                          {intern.user?.hub?.name || intern.internshipType?.name || '—'}
                        </span>
                      </span>
                      <span className="shrink-0 text-[11px] capitalize text-muted-foreground">
                        {intern.status}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3">
              <span className="text-[11px] text-muted-foreground">
                {pages > 1
                  ? `Page ${page} of ${pages}`
                  : `${total} intern${total === 1 ? '' : 's'} assigned to you`}
              </span>
              <div className="flex items-center gap-2.5">
                {pages > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      aria-label="Previous page"
                      data-test="mentor-dashboard-interns-prev"
                      className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.min(pages, p + 1))}
                      disabled={page >= pages}
                      aria-label="Next page"
                      data-test="mentor-dashboard-interns-next"
                      className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                <Link
                  to="/my-interns"
                  className="text-[11px] font-semibold text-primary hover:underline"
                  data-test="mentor-dashboard-interns-link"
                >
                  View all →
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardCard>
  );
}
