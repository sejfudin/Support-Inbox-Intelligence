import { PageSection, PageShell } from '@/components/PageShell';
import PageHeading from '@/components/PageHeading';
import { InternPositionDeclaration } from '@/components/interns/InternPositionDeclaration';
import { InternTechnologyDeclaration } from '@/components/interns/InternTechnologyDeclaration';
import { InternCvPanel } from '@/components/interns/InternCvPanel';
import { InternReadinessSummary } from '@/components/interns/InternReadinessSummary';
import { InternMentorsCard } from '@/components/interns/InternMentorsCard';

/**
 * Two columns, not the centred single column this page used to be: the left is
 * what the intern edits (position, the technology list), the right is what the
 * programme knows about them (CV, how the assessments stand, who assesses).
 * The declaration list is the tallest thing here, so the rail is what fills the
 * space beside it instead of leaving a page of whitespace.
 *
 * The four blocks are grid items of one grid rather than two stacked columns, so
 * the two rows are shared across both sides: row one is as tall as the taller of
 * Position and CV and both stretch to it, which is what keeps the second row
 * starting at the same height on the left and in the rail. Nested columns let each
 * side run its own heights, and the cards ended up a card-header off from each
 * other.
 *
 * Stacked below `lg` the rail belongs after the things it annotates, but grid
 * auto-placement wants CV second — hence the `order` overrides, dropped again at
 * `lg` where the two-column source order is the right one.
 */
const MyTechnologiesPage = () => {
  return (
    <PageShell>
      <PageSection className="space-y-3.5">
        <PageHeading
          crumb="Internship"
          title="Position & technologies"
          subtitle="Declare your position and the technologies you are working toward."
        />

        <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <InternPositionDeclaration />
          <InternCvPanel className="order-3 lg:order-none" />
          <InternTechnologyDeclaration className="order-2 lg:order-none" />
          <div className="order-4 flex flex-col gap-3.5 lg:order-none">
            <InternReadinessSummary />
            <InternMentorsCard />
          </div>
        </div>
      </PageSection>
    </PageShell>
  );
};

export default MyTechnologiesPage;
