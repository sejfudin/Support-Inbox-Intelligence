import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TooltipProvider } from '@/components/ui/tooltip';
import { PageSection, PageShell } from '@/components/PageShell';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/AuthContext';
import { useInternDashboard } from '@/queries/internDashboard';
import { useMyAttendance, useCheckInToday } from '@/queries/attendance';
import { useTicketModals } from '@/hooks/useTicketModals';
import { useTicketModalTitle } from '@/hooks/useTicketModalTitle';
import TicketDetailsModal from '@/components/Modals/LazyTicketDetailsModal';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { useTourActive, withTourSamples } from '@/components/onboarding/tourPreview';
import { AttendanceHeroCard } from '@/components/intern/dashboard/AttendanceHeroCard';
import { MyWorkloadCard } from '@/components/intern/dashboard/MyWorkloadCard';
import { MyStandupCard } from '@/components/intern/dashboard/MyStandupCard';
import { MyTicketsPanel } from '@/components/intern/dashboard/MyTicketsPanel';
import { MyPipelineCard } from '@/components/intern/dashboard/MyPipelineCard';
import { MyEvaluationsCard } from '@/components/intern/dashboard/MyEvaluationsCard';

// Three equal columns up top — attendance hero, workload, standup — and below
// them the tickets panel across the first two with the pipeline/evaluations rail
// in the third, matching the mockup.
const TOP_ROW_CLASS = 'grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3';

// Three cards into two columns leaves one orphaned on its own row, with dead
// space beside it and the empty workload card stretched to the hero's height. So
// at `md` the hero takes the full width and workload/standup pair up underneath —
// they are the two compact cards, so they sit level. Back to one-per-column at
// `xl`, where all three fit.
const HERO_SPAN_CLASS = 'md:col-span-2 xl:col-span-1';

// No fixed heights: whichever column is taller sets the row height and the other
// stretches to it. That is what keeps the tickets panel's footer level with the
// bottom of the evaluations card instead of floating short of it.
const BOTTOM_ROW_CLASS = 'grid grid-cols-1 gap-4 xl:grid-cols-3';

// The two rail cards each start at their content height and split whatever height
// is left over. `grow` and not `flex-1`: `flex-1` is `flex: 1 1 0%`, which zeroes
// the basis and forces a 50/50 split regardless of content — an evaluations card
// with two or more past periods needs more than half and would spill out of its
// own panel. Content is the floor here, so it can't.
const RAIL_CARD_CLASS = 'grow';

/** Card-shaped skeleton shell, so a loading card still looks like a card. */
function SkeletonCard({ className }) {
  return (
    <div className={cn('app-panel-soft flex min-h-[12.5rem] flex-col p-4 sm:p-5', className)}>
      <Skeleton className="h-2.5 w-28" />
      <div className="mt-4 space-y-2">
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-2.5 w-36 max-w-full" />
      </div>
      <Skeleton className="mt-auto h-10 w-full rounded-xl" />
    </div>
  );
}

/**
 * Mirrors the real content rather than showing flat slabs — the KPI number, the
 * button, the ticket rows. Four featureless rectangles next to a rendered card
 * read as four failed requests; these read as a page filling in, and nothing
 * re-flows when the data lands.
 */
function TicketsPanelSkeleton() {
  return (
    <div className="app-panel flex min-h-[30rem] w-full flex-col p-4 sm:p-5">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="mt-2 h-3 w-48" />

      <Skeleton className="mt-4 h-[7.5rem] w-full rounded-[1rem]" />

      <div className="mt-5 space-y-4">
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="flex items-center gap-3">
            <Skeleton className="h-1.5 w-1.5 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-3 w-44 max-w-full" />
              <Skeleton className="h-2.5 w-24" />
            </div>
            <Skeleton className="h-4 w-16 shrink-0 rounded-full" />
            <Skeleton className="h-2.5 w-10 shrink-0" />
          </div>
        ))}
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-border/50 pt-4">
        <Skeleton className="h-2.5 w-40" />
        <Skeleton className="h-2.5 w-14" />
      </div>
    </div>
  );
}

/**
 * The intern's home screen. Replaces the assigned-tickets table that used to
 * live at `/dashboard` — the same tickets are still reachable in full at
 * `/tickets?assignee=me`, which this page's "View all" links to.
 *
 * Two queries, deliberately:
 * - `useInternDashboard` — one aggregate for workload, tickets, standup,
 *   pipeline and evaluations, all scoped server-side to the authenticated user.
 * - `useMyAttendance` — the hero. Left on its own endpoint because the check-in
 *   mutation already seeds and invalidates that cache; folding attendance into
 *   the aggregate would give the hero two sources that disagree for a frame
 *   after checking in.
 */
export default function InternDashboardPage() {
  const { user } = useAuth();
  const { selectedTicketId, isDetailsOpen, openTicketDetails, closeTicketDetails } =
    useTicketModals();
  useTicketModalTitle({ ticketId: selectedTicketId, isOpen: isDetailsOpen });
  const location = useLocation();

  const { data: realDashboard, isPending, isError, error } = useInternDashboard();
  const { data: attendance, isPending: attendancePending } = useMyAttendance();
  const { mutate: checkIn, isPending: isCheckingIn } = useCheckInToday();

  // A notification (e.g. a placement) links here with a `#my-selection-process`
  // style hash so the intern lands ON the relevant card, not just the page —
  // the real cards (and their ids) only exist once loading finishes, so this
  // waits on `isPending` rather than firing against the skeleton.
  useEffect(() => {
    if (isPending || !location.hash) return;
    const target = document.getElementById(location.hash.slice(1));
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [isPending, location.hash]);

  // While the what's-new tour is up, cards that are genuinely empty show example
  // data so the tour has something to point at — a first-day intern has no
  // recommendation, no evaluation and no standup, and the tour would otherwise
  // spotlight three empty states. Real data is never replaced, and every
  // substituted card is labelled; see `tourPreview.js`.
  const tourActive = useTourActive();
  const { dashboard, preview } = withTourSamples(realDashboard, tourActive);

  return (
    <TooltipProvider delayDuration={200}>
      <PageShell>
        <PageSection className="space-y-5">
          <DashboardHeader user={user} />

          {isError && (
            <div className="app-panel px-6 py-8 text-center">
              <p className="text-sm font-medium text-[hsl(var(--tone-danger-fg))]">
                Could not load your dashboard.
              </p>
              <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-muted-foreground">
                {error?.response?.data?.message || 'Please try again.'}
              </p>
            </div>
          )}

          {!isError && (
            <>
              <div className={TOP_ROW_CLASS}>
                {attendancePending ? (
                  <SkeletonCard className={HERO_SPAN_CLASS} />
                ) : (
                  <AttendanceHeroCard
                    className={HERO_SPAN_CLASS}
                    records={attendance?.records}
                    cancelledDates={attendance?.cancelledDates}
                    month={attendance?.month}
                    placedAt={attendance?.placedAt}
                    nonWorkingDays={attendance?.nonWorkingDays}
                    startDate={attendance?.startDate}
                    requestedDays={attendance?.requestedDays}
                    onCheckIn={() => checkIn()}
                    isCheckingIn={isCheckingIn}
                  />
                )}

                {isPending ? (
                  <>
                    <SkeletonCard />
                    <SkeletonCard />
                  </>
                ) : (
                  <>
                    <MyWorkloadCard workload={dashboard?.workload} isPreview={preview.workload} />
                    <MyStandupCard standup={dashboard?.standup} isPreview={preview.standup} />
                  </>
                )}
              </div>

              {/* An intern between workspaces still has a programme — only the
                  workspace-scoped half goes quiet, so say which half and why
                  rather than rendering three convincing zeroes. */}
              {!isPending && !dashboard?.workspace && (
                <div className="app-panel px-6 py-5 text-center">
                  <p className="text-sm font-medium text-foreground">No active workspace</p>
                  <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-muted-foreground">
                    Your tickets and standup live in a workspace. Ask your mentor to add you to one
                    — your attendance and programme progress above are unaffected.
                  </p>
                  <Link
                    to="/invitations"
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                  >
                    Check my invitations
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              )}

              <div className={BOTTOM_ROW_CLASS}>
                <div className="flex min-w-0 xl:col-span-2">
                  {isPending ? (
                    <TicketsPanelSkeleton />
                  ) : (
                    <MyTicketsPanel
                      tickets={dashboard?.tickets}
                      onOpenTicket={openTicketDetails}
                      isPreview={preview.tickets}
                    />
                  )}
                </div>

                {/* The rail's two cards share the surplus rather than splitting
                    the column in half — the taller one stays taller. That is
                    deliberate: the evaluations card lists up to three past
                    periods, and an exact 50/50 gives it less height than those
                    rows need. Whichever column ends up taller sets the grid row,
                    so the rail and the tickets panel still end level. */}
                <div className="flex min-w-0 flex-col gap-4">
                  {isPending ? (
                    <>
                      <SkeletonCard className={RAIL_CARD_CLASS} />
                      <SkeletonCard className={RAIL_CARD_CLASS} />
                    </>
                  ) : (
                    <>
                      <MyPipelineCard
                        pipeline={dashboard?.pipeline}
                        className={RAIL_CARD_CLASS}
                        isPreview={preview.pipeline}
                      />
                      <MyEvaluationsCard
                        evaluations={dashboard?.evaluations}
                        className={RAIL_CARD_CLASS}
                        isPreview={preview.evaluations}
                      />
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </PageSection>
      </PageShell>

      <TicketDetailsModal
        ticketId={selectedTicketId}
        isOpen={isDetailsOpen}
        onClose={closeTicketDetails}
      />
    </TooltipProvider>
  );
}
