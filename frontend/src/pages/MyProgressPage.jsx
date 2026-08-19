import { useCallback, useState } from 'react';

import { PageSection, PageShell } from '@/components/PageShell';
import PageHeading from '@/components/PageHeading';
import { Accordion } from '@/components/ui/accordion';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsCount, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useInternProgress } from '@/queries/internProgress';
import { MyEvaluationsSection } from '@/components/intern/progress/MyEvaluationsSection';
import { MyMentorNotesSection } from '@/components/intern/progress/MyMentorNotesSection';
import { MyReadinessSection } from '@/components/intern/progress/MyReadinessSection';
import { MyRecommendationsSection } from '@/components/intern/progress/MyRecommendationsSection';
import { ProgressOverview } from '@/components/intern/progress/ProgressOverview';

/**
 * Nothing is open on arrival. `ProgressOverview` above the accordion is what the
 * page says on load — status, timeline, and the three stat tiles — and each
 * closed card still states its own summary on the right, so a shut page still
 * reads. Opening one is then a question the reader asked, not a scroll they
 * inherited.
 */
const OPEN_ON_LOAD = [];

/**
 * Card-shaped placeholder, so a loading section still reads as a section.
 *
 * The default is the band on its own, which is what every section looks like once
 * it loads — the placeholder should not promise bodies that arrive closed.
 */
function SectionSkeleton({ rows = 0 }) {
  return (
    <div className="app-card overflow-hidden">
      <div className="app-card-head block">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-2 h-3 w-72 max-w-full" />
      </div>
      {rows > 0 ? (
        <div className="space-y-2.5 p-[18px]">
          {Array.from({ length: rows }, (_, row) => (
            <Skeleton key={row} className="h-11 w-full rounded-[var(--r-tile)]" />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * "My progress" — the read-only mirror of everything the programme records about
 * the signed-in intern: where they stand, their evaluations (scores and their
 * mentor's notes), their readiness, every recommendation they have been part of,
 * and any mentor/admin note whose author chose to share it with them directly
 * (most mentor notes stay staff-only and never reach this page — see
 * `server/services/internProgressService.js`).
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
 * the intern's own declarations live on their own pages, linked from the overview
 * card, because those the intern *can* change.
 *
 * **Three tabs, not one long scroll.** Evaluations and recommendations are things
 * that *happen* to the intern over time — a history to look up, not a fact to have
 * in view alongside everything else — so each gets its own tab (`Tabs` is the
 * "what the page is" control per its own doc-comment, not a `Switcher`, and this is
 * exactly that: the heading and the data both change). The Overview tab keeps
 * everything that answers "where do I stand right now": the always-open
 * `ProgressOverview` card (status, timeline, stat tiles, and the programme's own
 * record of dates/position/mentors/hub — previously a second, separate "Programme
 * details" dropdown, now one section so the basics aren't hidden behind a click),
 * plus readiness and mentor notes as two closed-by-default cards underneath —
 * occasional reading, not the headline.
 */
export default function MyProgressPage() {
  const { data, isPending, isError, error } = useInternProgress();
  const [tab, setTab] = useState('overview');
  const [openSections, setOpenSections] = useState(OPEN_ON_LOAD);

  /**
   * A header tile opens its section and scrolls to it — never closes it, because a
   * second click on the tile you just used to look at something would take it
   * away again. The scroll waits a frame: the panel has to exist at its open
   * height before `scrollIntoView` can aim at it.
   */
  const openSection = useCallback((id) => {
    setOpenSections((current) => (current.includes(id) ? current : [...current, id]));
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  const evaluationCount = data?.evaluations?.total ?? 0;
  const recommendationCount = data?.recommendations?.total ?? 0;

  return (
    <PageShell>
      <PageSection className="space-y-3.5">
        {/* "Yours to read, not to edit" is back in the subtitle. It lived on the
            rail's mentors card, and it is the answer to "why is there nothing to
            click here" — a fact about the whole page, so it belongs under the H1
            now that there is no rail to hold it. */}
        <PageHeading
          crumb="Internship"
          title="My Progress"
          subtitle="Where you stand in the programme, your evaluations, your placement readiness, and every project you have been recommended for — recorded by your mentors and admins, yours to read, not to edit."
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
          <div className="flex flex-col gap-3.5">
            <div className="app-card flex flex-col gap-4 p-[18px]">
              <Skeleton className="h-5 w-52" />
              <Skeleton className="h-1.5 w-full rounded-[var(--r-pill)]" />
              <div className="grid gap-2.5 sm:grid-cols-3">
                <Skeleton className="h-[74px] rounded-[var(--r-tile)]" />
                <Skeleton className="h-[74px] rounded-[var(--r-tile)]" />
                <Skeleton className="h-[74px] rounded-[var(--r-tile)]" />
              </div>
            </div>
            <SectionSkeleton />
            <SectionSkeleton />
          </div>
        )}

        {!isError && !isPending && (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList data-test="my-progress-tabs">
              <TabsTrigger value="overview" data-test="my-progress-tab-overview">
                Overview
              </TabsTrigger>
              <TabsTrigger value="evaluations" data-test="my-progress-tab-evaluations">
                Evaluations
                {evaluationCount > 0 && <TabsCount>{evaluationCount}</TabsCount>}
              </TabsTrigger>
              <TabsTrigger value="recommendations" data-test="my-progress-tab-recommendations">
                Recommendations
                {recommendationCount > 0 && <TabsCount>{recommendationCount}</TabsCount>}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="flex flex-col gap-3.5">
              <ProgressOverview
                programme={data?.programme}
                readiness={data?.readiness}
                evaluations={data?.evaluations}
                recommendations={data?.recommendations}
                onOpenReadiness={() => openSection('my-progress-readiness')}
                onGoToEvaluations={() => setTab('evaluations')}
                onGoToRecommendations={() => setTab('recommendations')}
              />

              {/* Side by side rather than stacked: readiness and mentor notes are
                  both occasional reading, not the headline, and two closed bands
                  of near-identical width read as a matched pair this way instead
                  of a lone half-empty row under the overview card. `items-start`
                  keeps each card at its own natural height — opening one must not
                  stretch the other to match and leave it half blank.
                  `type="multiple"`: the two are independent, so opening one to
                  check something should not cost the other. */}
              <Accordion
                type="multiple"
                value={openSections}
                onValueChange={setOpenSections}
                className="grid items-start gap-3.5 lg:grid-cols-2"
              >
                <MyReadinessSection readiness={data?.readiness} />
                <MyMentorNotesSection mentorNotes={data?.mentorNotes} />
              </Accordion>
            </TabsContent>

            <TabsContent value="evaluations">
              <MyEvaluationsSection evaluations={data?.evaluations} collapsible={false} />
            </TabsContent>

            <TabsContent value="recommendations">
              <MyRecommendationsSection
                recommendations={data?.recommendations}
                collapsible={false}
              />
            </TabsContent>
          </Tabs>
        )}
      </PageSection>
    </PageShell>
  );
}
