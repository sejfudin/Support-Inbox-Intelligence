import { PageSection, PageShell } from '@/components/PageShell';
import PageHeading from '@/components/PageHeading';
import { Skeleton } from '@/components/ui/skeleton';
import { useInternProgress } from '@/queries/internProgress';
import { ProgrammeSnapshot } from '@/components/intern/progress/ProgrammeSnapshot';
import { MyEvaluationsSection } from '@/components/intern/progress/MyEvaluationsSection';
import { MyReadinessSection } from '@/components/intern/progress/MyReadinessSection';
import { MyRecommendationsSection } from '@/components/intern/progress/MyRecommendationsSection';
import { ProgressRail } from '@/components/intern/progress/ProgressRail';

/** Card-shaped placeholder, so a loading section still reads as a section. */
function SectionSkeleton({ rows = 3 }) {
  return (
    <div className="app-card overflow-hidden">
      <div className="app-card-head block">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-2 h-3 w-72 max-w-full" />
      </div>
      <div className="space-y-2.5 p-[18px]">
        {Array.from({ length: rows }, (_, row) => (
          <Skeleton key={row} className="h-11 w-full rounded-[var(--r-tile)]" />
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
      <PageSection className="space-y-3.5">
        {/* The "yours to read, not to edit" half of the old subtitle now sits in the
            rail, on the card naming the mentors it is about. The subtitle says what
            the page holds; the rail says who put it there. */}
        <PageHeading
          crumb="Internship"
          title="My Progress"
          subtitle="Where you stand in the programme, your evaluations, your placement readiness, and every project you have been recommended for."
        />

        {isError && (
          <div className="app-card px-6 py-8 text-center">
            <p className="text-sm font-medium text-[hsl(var(--tone-danger-fg))]">
              Could not load your progress.
            </p>
            <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-muted-foreground">
              {/* A 404 here means the account has no intern profile yet, which is a
                  real state with a real fix (an admin sets it up) rather than a
                  transient failure — so the server's message is shown as-is. */}
              {error?.response?.data?.message || 'Please try again.'}
            </p>
          </div>
        )}

        {!isError && isPending && (
          <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
            <div className="flex flex-col gap-3.5">
              <SectionSkeleton rows={3} />
              <SectionSkeleton rows={2} />
            </div>
            <SectionSkeleton rows={3} />
          </div>
        )}

        {/* Two columns: the four sections on the left, the page index and the people
            behind it on the right. The rail is what fills the space beside a page
            whose sections are mostly empty for a new intern — the same
            1.55fr/1fr split `/my-technologies` one nav row away uses.

            Evaluations and Recommendations pair up below the two full-width
            sections. They are the two "a list, once someone records something"
            blocks, so side by side they read as one row of the same kind of thing;
            `xl` is where the left column is wide enough for a populated evaluation's
            score bars to survive the halving. */}
        {!isError && !isPending && (
          <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
            <div className="flex flex-col gap-3.5">
              <ProgrammeSnapshot programme={data?.programme} />
              <MyReadinessSection readiness={data?.readiness} />
              <div className="grid gap-3.5 xl:grid-cols-2">
                <MyEvaluationsSection evaluations={data?.evaluations} />
                <MyRecommendationsSection recommendations={data?.recommendations} />
              </div>
            </div>

            <ProgressRail
              programme={data?.programme}
              readiness={data?.readiness}
              evaluations={data?.evaluations}
              recommendations={data?.recommendations}
            />
          </div>
        )}
      </PageSection>
    </PageShell>
  );
}
