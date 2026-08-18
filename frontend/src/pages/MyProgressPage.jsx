import { useCallback, useState } from 'react';

import { PageSection, PageShell } from '@/components/PageShell';
import PageHeading from '@/components/PageHeading';
import { Accordion } from '@/components/ui/accordion';
import { Skeleton } from '@/components/ui/skeleton';
import { useInternProgress } from '@/queries/internProgress';
import { ProgrammeSnapshot } from '@/components/intern/progress/ProgrammeSnapshot';
import { MyEvaluationsSection } from '@/components/intern/progress/MyEvaluationsSection';
import { MyMentorNotesSection } from '@/components/intern/progress/MyMentorNotesSection';
import { MyReadinessSection } from '@/components/intern/progress/MyReadinessSection';
import { MyRecommendationsSection } from '@/components/intern/progress/MyRecommendationsSection';
import { ProgressHeader } from '@/components/intern/progress/ProgressHeader';

/**
 * Nothing is open on arrival. The summary band above the cards is what the page
 * says on load — status, how far through, and the three counts — and each closed
 * card still states its own summary on the right, so a shut page still reads.
 * Opening one is then a question the reader asked, not a scroll they inherited.
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
 * the intern's own declarations live on their own pages, linked from the first
 * panel, because those the intern *can* change.
 */
export default function MyProgressPage() {
  const { data, isPending, isError, error } = useInternProgress();
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
            <SectionSkeleton />
            <SectionSkeleton />
            <SectionSkeleton />
          </div>
        )}

        {/* The page in two registers: one band that answers "where do I stand?"
            outright, then the record itself as cards you open.

            Both halves of the length problem are handled, and they are different
            problems. BETWEEN sections: every card starts closed, carrying its own
            count on the band, so what loads is the summary and nothing else. INSIDE
            a section: the newest evaluation and the newest recommendation render in
            full and everything older is one line, so opening one is not six screens
            of history.

            What it is not is a two-column board. The right rail held an "on this
            page" index and the mentors behind the record — an index is what a page
            needs when it is too tall to survey, and the header's tiles do that job
            now by opening the section they summarise.

            Order is by what an intern does with it: readiness is the only section
            they can move, evaluations and recommendations are what happens to them,
            notes are occasional, and the programme facts are reference — looked up,
            not read. `type="multiple"` because these are independent: comparing an
            evaluation against the readiness it produced should not cost the one you
            were reading. */}
        {!isError && !isPending && (
          <>
            <ProgressHeader
              programme={data?.programme}
              readiness={data?.readiness}
              evaluations={data?.evaluations}
              recommendations={data?.recommendations}
              onOpen={openSection}
            />

            <Accordion
              type="multiple"
              value={openSections}
              onValueChange={setOpenSections}
              className="flex flex-col gap-3.5"
            >
              <MyReadinessSection readiness={data?.readiness} />
              <MyEvaluationsSection evaluations={data?.evaluations} />
              <MyRecommendationsSection recommendations={data?.recommendations} />
              <MyMentorNotesSection mentorNotes={data?.mentorNotes} />
              <ProgrammeSnapshot programme={data?.programme} />
            </Accordion>
          </>
        )}
      </PageSection>
    </PageShell>
  );
}
