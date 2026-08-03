import { RecentPlacementsSection } from './RecentPlacementsSection';
import { SpecializationAssignedSection } from './SpecializationAssignedSection';

/**
 * "Recent placements" and "Specialization assigned" in one panel, split by a
 * divider. They read as a pair — both answer "who moved where lately" — and two
 * separate panels for two short lists left the top row looking busier than the
 * four-quarter mockup.
 *
 * Spans two of the top row's four columns, so each half keeps the width a single
 * quarter had. Below `xl` the row is at most two columns wide, so the halves
 * stack and the divider turns horizontal.
 */
export function PlacementsSpecializationCard({ placements }) {
  return (
    <section
      className="app-panel-soft grid min-h-[12.5rem] grid-cols-1 gap-4 p-4 sm:p-5 xl:col-span-2 xl:grid-cols-2 xl:gap-0"
      aria-label="Recent placements and specialization assignments"
    >
      <div className="flex min-w-0 flex-col xl:pr-5">
        <RecentPlacementsSection placements={placements} />
      </div>

      <div className="flex min-w-0 flex-col border-t border-border/60 pt-4 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0">
        <SpecializationAssignedSection />
      </div>
    </section>
  );
}
