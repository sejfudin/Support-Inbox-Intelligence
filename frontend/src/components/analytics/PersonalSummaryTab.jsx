import PersonalAnalyticsSection from '@/components/PersonalAnalyticsSection';

/**
 * The period control now lives on the page's tab band (see `AnalyticsDashboard`),
 * so this tab no longer carries a header card of its own — the mockup opens the
 * tab straight onto the stat row.
 */
export default function PersonalSummaryTab({ userAnalytics, isLoading, isError, days }) {
  return (
    <PersonalAnalyticsSection
      userAnalytics={userAnalytics}
      isLoading={isLoading}
      isError={isError}
      days={days}
      showHeader={false}
    />
  );
}
