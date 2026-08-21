import { ChartNoAxesCombined } from 'lucide-react';
import AnalyticsSection from '@/components/analytics/AnalyticsSection';

/**
 * The empty counterpart of `AnalyticsSection` — same card, same title block, with
 * the mockup's dashed empty slot where the chart would be. It keeps its own 150px
 * body so a row with one empty panel still lines up with the populated one.
 */
export function AnalyticsEmptyCard({ title, description }) {
  return (
    <AnalyticsSection title={title} description={description}>
      <div className="flex h-[150px] flex-col items-center justify-center gap-1.5 rounded-[var(--r-tile)] border border-dashed border-border text-muted-foreground/75">
        <ChartNoAxesCombined className="h-6 w-6 opacity-50" aria-hidden />
        <p className="text-[12.5px] font-medium">No activity in selected period</p>
        <p className="text-[11px]">Try a longer date range or create/update tickets.</p>
      </div>
    </AnalyticsSection>
  );
}
