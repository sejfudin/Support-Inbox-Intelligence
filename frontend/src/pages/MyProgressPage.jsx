import { Eye } from 'lucide-react';
import { PageSection, PageShell } from '@/components/PageShell';
import PageHeading from '@/components/PageHeading';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useInternProgress } from '@/queries/internProgress';
import { ProgrammeSnapshot } from '@/components/intern/progress/ProgrammeSnapshot';
import { MyEvaluationsSection } from '@/components/intern/progress/MyEvaluationsSection';
import { MyReadinessSection } from '@/components/intern/progress/MyReadinessSection';
import { MyRecommendationsSection } from '@/components/intern/progress/MyRecommendationsSection';

/** Panel-shaped placeholder, so a loading section still reads as a section. */
function SectionSkeleton({ rows = 3 }) {
  return (
    <div className="app-panel overflow-hidden p-0">
      <div className="border-b border-border/60 px-5 py-4 md:px-6">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-2 h-3 w-72 max-w-full" />
      </div>
      <div className="space-y-3 px-5 py-5 md:px-6">
        {Array.from({ length: rows }, (_, row) => (
          <Skeleton key={row} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

/**
 * "My progress" — the read-only mirror of everything the programme records about
 * the signed-in intern: where they stand, their evaluations (scores and their
 * mentor's notes), their readiness, and every recommendation they have been part of.
 *
 * One query. The endpoint is a single self-scoped aggregate that takes no
 * parameters (`GET /api/dashboard/me/progress`), so the page has one loading state,
 * one error state, and one cache key that the `intern:all` socket scope refreshes
 * when an admin records something — see `lib/invalidationScopes.js`.
 *
 * **Read-only is a property of the data, not of this page.** Every section here is
 * admin-authored: evaluations and readiness through `/api/interns/:userId/...`,
 * recommendations through `/api/recommendations`, all `requireRole(ADMIN)`. There is
 * no mutation hook in this tree and no endpoint behind it to call. Attendance and
 * the intern's own declarations live on their own pages, linked from the first
 * panel, because those the intern *can* change.
 */
export default function MyProgressPage() {
  const { data, isPending, isError, error } = useInternProgress();

  return (
    <PageShell>
      <PageSection className="space-y-5">
        <PageHeading
          kicker="Internship"
          title="My Progress"
          subtitle="Where you stand in the programme, your evaluations, your placement readiness, and every project you have been recommended for. All of it is recorded by your mentors and admins — yours to read, not to edit."
          titleAdornment={
            <Badge variant="outline" className="gap-1.5">
              <Eye className="h-3.5 w-3.5" />
              Read-only
            </Badge>
          }
        />

        {isError && (
          <div className="app-panel px-6 py-8 text-center">
            <p className="text-sm font-medium text-destructive">Could not load your progress.</p>
            <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-muted-foreground">
              {/* A 404 here means the account has no intern profile yet, which is a
                  real state with a real fix (an admin sets it up) rather than a
                  transient failure — so the server's message is shown as-is. */}
              {error?.response?.data?.message || 'Please try again.'}
            </p>
          </div>
        )}

        {!isError && isPending && (
          <>
            <SectionSkeleton rows={2} />
            <SectionSkeleton rows={3} />
            <SectionSkeleton rows={2} />
          </>
        )}

        {!isError && !isPending && (
          <>
            <ProgrammeSnapshot programme={data?.programme} />
            <MyEvaluationsSection evaluations={data?.evaluations} />
            <MyReadinessSection readiness={data?.readiness} />
            <MyRecommendationsSection recommendations={data?.recommendations} />
          </>
        )}
      </PageSection>
    </PageShell>
  );
}
