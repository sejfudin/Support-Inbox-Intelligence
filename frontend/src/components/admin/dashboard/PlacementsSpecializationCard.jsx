import { RecentPlacementsSection } from './RecentPlacementsSection';
import { SpecializationAssignedSection } from './SpecializationAssignedSection';

/**
 * "Recent placements" and "Specialization assigned" in one panel, split by a
 * divider. They read as a pair — both answer "who moved where lately" — and two
 * separate panels for two short lists left the top row looking busier than the
 * four-quarter mockup.
 *
 * Spans two of the top row's four columns at `xl`, so each half keeps the width a
 * single quarter had. Below that the row is at most two columns wide, so the card
 * takes the whole row (`md:col-span-2`) rather than half of it — that is what lets
 * the two halves stay side by side down to `sm` instead of stacking the moment the
 * four-quarter layout breaks. Only below `sm`, where a half would be ~150px, do
 * they stack and the divider turn horizontal.
 */
export function PlacementsSpecializationCard({ placements, specializations }) {
  return (
    <section
      className="app-panel-soft grid min-h-[12.5rem] grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:gap-0 sm:p-5 md:col-span-2"
      data-tour="dashboard-placements"
      aria-label="Recent placements and specialization assignments"
    >
      <div className="flex min-w-0 flex-col sm:pr-5">
        <RecentPlacementsSection placements={placements} />
      </div>

      <div className="flex min-w-0 flex-col border-t border-border/60 pt-4 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
        <SpecializationAssignedSection specializations={specializations} />
      </div>
    </section>
  );
}
