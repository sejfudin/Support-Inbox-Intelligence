import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TooltipProvider } from '@/components/ui/tooltip';
import { PageSection, PageShell } from '@/components/PageShell';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/AuthContext';
import { useAdminDashboard } from '@/queries/adminDashboard';
import { useWorkspaceDailyOverview } from '@/queries/dailies';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { PresenceHeroCard } from '@/components/admin/dashboard/PresenceHeroCard';
import { LastPlacementCard } from '@/components/admin/dashboard/LastPlacementCard';
import { MoreStatisticsCard } from '@/components/admin/dashboard/MoreStatisticsCard';
import { PlacementsSpecializationCard } from '@/components/admin/dashboard/PlacementsSpecializationCard';
import { WorkspaceInternsPanel } from '@/components/admin/dashboard/WorkspaceInternsPanel';
import { QuickActionsCard } from '@/components/admin/dashboard/QuickActionsCard';
import { TodayStandupCard } from '@/components/admin/dashboard/TodayStandupCard';
import { ReviewsOwedCard } from '@/components/admin/dashboard/ReviewsOwedCard';
import { InternPickerModal } from '@/components/admin/dashboard/InternPickerModal';
import { NewRecommendationDialog } from '@/components/admin/dashboard/NewRecommendationDialog';
import { NewEvaluationDialog } from '@/components/admin/dashboard/NewEvaluationDialog';
import LazyNewTickets from '@/components/Tickets/LazyNewTickets';
import { useTicketStatuses } from '@/hooks/useTicketStatuses';

// The mockup's top row is four equal quarters; the second quarter holds two
// smaller cards side by side. Below it, the same 4-column grid splits 3 / 1 into
// the interns table and the right-hand rail.
const TOP_ROW_CLASS = 'grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4';

// No fixed height and no inner scrollbar: the interns panel grows with its rows.
// Whichever column is taller sets the row height and the other stretches to it —
// the rail's standup card flexes, the interns panel pushes its footer down — so
// the two columns still end on the same line at any intern count.
const BOTTOM_ROW_CLASS = 'grid grid-cols-1 gap-4 xl:grid-cols-4';

/**
 * Card-shaped skeleton shell, so a loading card still looks like a card.
 * `cn` (tailwind-merge) is what lets the split card override `flex` with `grid`.
 */
function SkeletonCard({ children, className }) {
  return (
    <div className={cn('app-panel-soft flex min-h-[12.5rem] flex-col p-4 sm:p-5', className)}>
      {children}
    </div>
  );
}

/** A kicker-height bar — every top-row card starts with one. */
function SkeletonKicker({ width = 'w-28' }) {
  return <Skeleton className={`h-2.5 ${width}`} />;
}

/** One avatar + two-line + trailing-value row, as used by both list cards. */
function SkeletonPersonRow() {
  return (
    <div className="flex items-center gap-2.5">
      <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-2.5 w-40 max-w-full" />
      </div>
      <Skeleton className="h-2.5 w-10 shrink-0" />
    </div>
  );
}

/**
 * Mirrors the real top row — hero, the quarter holding two small cards, and the
 * double-width placements/specialization card — and mirrors each card's *content*,
 * not just its outline.
 *
 * Flat grey slabs were the problem: four featureless rectangles next to a
 * fully-rendered rail read as four failed requests rather than as loading. These
 * echo the real shapes (big KPI number, progress bar, button, person rows) so the
 * page looks like it is filling in, and nothing jumps when it does.
 */
function TopRowSkeleton() {
  return (
    <div className={TOP_ROW_CLASS}>
      {/* Presence hero — kicker + badge, big number, meter, sub-line, button. */}
      <SkeletonCard className="justify-between">
        <div>
          <div className="flex items-start justify-between gap-2">
            <SkeletonKicker width="w-32" />
            <Skeleton className="h-4 w-20 shrink-0 rounded-full" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <Skeleton className="h-10 w-14" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="mt-4 h-1.5 w-full rounded-full" />
          <Skeleton className="mt-2 h-2.5 w-44 max-w-full" />
        </div>
        <Skeleton className="mt-4 h-10 w-full rounded-xl" />
      </SkeletonCard>

      {/* Last placement, with the slim analytics link strip under it. */}
      <div className="flex min-w-0 flex-col gap-4">
        <SkeletonCard className="min-h-0 flex-1 justify-between">
          <div className="flex items-start justify-between gap-2">
            <SkeletonKicker width="w-28" />
            <Skeleton className="h-3.5 w-3.5 shrink-0 rounded" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-2.5 w-32" />
          </div>
        </SkeletonCard>

        <div className="flex shrink-0 items-center gap-3 rounded-[1.25rem] border border-dashed border-border px-4 py-3 sm:px-5">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-2.5 w-40 max-w-full" />
          </div>
          <Skeleton className="h-3 w-16 shrink-0" />
        </div>
      </div>

      {/* Recent placements | Specialization assigned, split by the same divider. */}
      <SkeletonCard className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-0 md:col-span-2">
        <div className="flex min-w-0 flex-col gap-3 sm:pr-5">
          <SkeletonKicker />
          <SkeletonPersonRow />
          <SkeletonPersonRow />
        </div>
        <div className="flex min-w-0 flex-col gap-3 border-t border-border/60 pt-4 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
          <SkeletonKicker width="w-36" />
          <SkeletonPersonRow />
          <SkeletonPersonRow />
        </div>
      </SkeletonCard>
    </div>
  );
}

/**
 * The interns panel while it loads. Deliberately structural rather than one flat
 * block: the rail beside it renders instantly (quick actions are static), so a
 * featureless grey rectangle next to a finished card looks like a failed request.
 */
function InternsPanelSkeleton() {
  return (
    <div className="app-panel flex w-full flex-col p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-3 w-64" />
        </div>
        <Skeleton className="h-3 w-24" />
      </div>

      <div className="mt-6 space-y-5">
        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-2.5 w-20" />
            </div>
            <div className="hidden shrink-0 items-center gap-1 sm:flex">
              {[0, 1, 2, 3].map((segment) => (
                <Skeleton key={segment} className="h-[1.125rem] w-10 rounded" />
              ))}
            </div>
            <Skeleton className="h-1.5 w-24 shrink-0 rounded-full sm:w-32" />
          </div>
        ))}
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-border/50 pt-4">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const { user } = useAuth();

  // Which quick action is open. One value rather than a boolean per modal, so two
  // can never be open at once. Recommend/evaluate are two-stage: the picker, then
  // the form for whoever was picked.
  const [openAction, setOpenAction] = useState(null);
  const [pickedIntern, setPickedIntern] = useState(null);

  // Scoped to the caller's active workspace. Switching is the sidebar's
  // WorkspaceSwitcher — it PATCHes the active workspace, refetches the user and
  // navigates back here, so this re-keys and refetches on its own.
  const workspaceId = user?.workspaceId || '';

  const {
    data: dashboard,
    isPending: dashboardPending,
    isError,
    error,
  } = useAdminDashboard(workspaceId);

  // Passed explicitly: useWorkspaceDailyOverview gates on `!!month`, so leaving
  // it undefined would keep the standup card permanently disabled.
  const currentMonthKey = useMemo(() => format(new Date(), 'yyyy-MM'), []);
  const { data: standupResponse, isPending: standupPending } = useWorkspaceDailyOverview(
    workspaceId,
    currentMonthKey
  );

  // For "Assign a ticket": the modal creates into the workspace the sidebar has
  // selected, so it needs that workspace's own statuses, not the caller's default.
  const { helpers: ticketStatusHelpers } = useTicketStatuses(workspaceId);

  const workspaceName = dashboard?.workspace?.name || '';

  // Picking an intern swaps the picker for the form, in place — the admin stays on
  // the dashboard rather than being thrown onto the intern's profile.
  const handleInternPicked = (intern) => {
    setPickedIntern(intern);
    setOpenAction(openAction === 'recommend-intern' ? 'recommend-form' : 'evaluate-form');
  };

  const closeAction = () => {
    setOpenAction(null);
    setPickedIntern(null);
  };

  // An admin can sit outside every workspace ("Global admin mode" in the sidebar).
  // The sidebar switcher only lists workspaces they are a member of and collapses
  // to a static label in that state, so point them at the full list instead.
  if (!workspaceId) {
    return (
      <PageShell>
        <PageSection className="space-y-5">
          <DashboardHeader user={user} />
          <div className="app-panel px-6 py-12 text-center">
            <p className="text-sm font-medium text-foreground">No active workspace</p>
            <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-muted-foreground">
              This board reports on one workspace at a time. Open a workspace to see presence,
              workload and placements.
            </p>
            <Link
              to="/admin/workspaces"
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              Browse all workspaces
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </PageSection>
      </PageShell>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <PageShell>
        <PageSection className="space-y-5">
          <DashboardHeader user={user} />

          {isError && (
            <div className="app-panel px-6 py-8 text-center">
              <p className="text-sm font-medium text-[hsl(var(--tone-danger-fg))]">
                Could not load this workspace&apos;s dashboard.
              </p>
              <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-muted-foreground">
                {error?.response?.data?.message || 'Please try again.'}
              </p>
            </div>
          )}

          {!isError && (
            <>
              {dashboardPending ? (
                <TopRowSkeleton />
              ) : (
                <div className={TOP_ROW_CLASS}>
                  <PresenceHeroCard presence={dashboard?.presence} />

                  {/* Stacked, not side by side: the analytics link is a slim strip
                      and the placement metric flexes to fill the rest, so the
                      quarter still ends level with the hero beside it. */}
                  <div className="flex min-w-0 flex-col gap-4">
                    <LastPlacementCard lastPlacement={dashboard?.lastPlacement} />
                    <MoreStatisticsCard />
                  </div>

                  <PlacementsSpecializationCard
                    placements={dashboard?.recentPlacements}
                    specializations={dashboard?.recentSpecializations}
                  />
                </div>
              )}

              <div className={BOTTOM_ROW_CLASS}>
                <div className="flex min-w-0 self-start xl:col-span-3">
                  {dashboardPending ? (
                    <InternsPanelSkeleton />
                  ) : (
                    <WorkspaceInternsPanel
                      workspaceName={dashboard?.workspace?.name}
                      interns={dashboard?.interns}
                      workloadBuckets={dashboard?.workloadBuckets}
                    />
                  )}
                </div>

                <div className="flex min-w-0 flex-col gap-4">
                  <QuickActionsCard onAction={setOpenAction} />
                  <TodayStandupCard
                    overview={standupResponse?.data}
                    isPending={standupPending}
                    workspaceId={workspaceId}
                  />
                  <ReviewsOwedCard workspaceId={workspaceId} />
                </div>
              </div>
            </>
          )}
        </PageSection>
      </PageShell>

      {/* Creates into the workspace the sidebar has selected — named in the modal
          so an admin who manages several does not file a ticket in the wrong one. */}
      <LazyNewTickets
        isOpen={openAction === 'assign-ticket'}
        onClose={() => setOpenAction(null)}
        workspaceId={workspaceId}
        statusOptions={ticketStatusHelpers?.statusOptions || []}
        initialStatus={ticketStatusHelpers?.defaultMainStatusId}
        contextNote={workspaceName ? `New ticket in ${workspaceName}` : undefined}
      />

      <InternPickerModal
        open={openAction === 'recommend-intern'}
        onClose={closeAction}
        onSelect={handleInternPicked}
        actionLabel="Recommend"
        title="Recommend an intern"
        description="Pick the intern to recommend — the recommendation form opens next."
      />

      <InternPickerModal
        open={openAction === 'write-evaluation'}
        onClose={closeAction}
        onSelect={handleInternPicked}
        actionLabel="Evaluate"
        title="Write an evaluation"
        description="Pick the intern to evaluate — the evaluation form opens next."
      />

      <NewRecommendationDialog
        internUserId={pickedIntern?.userId}
        open={openAction === 'recommend-form'}
        onClose={closeAction}
      />

      <NewEvaluationDialog
        internUserId={pickedIntern?.userId}
        open={openAction === 'evaluate-form'}
        onClose={closeAction}
      />
    </TooltipProvider>
  );
}
