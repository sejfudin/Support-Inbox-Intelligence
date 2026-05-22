import PersonalAnalyticsSection from '@/components/PersonalAnalyticsSection';
import AnalyticsPeriodSelect from '@/components/analytics/AnalyticsPeriodSelect';

export default function PersonalSummaryTab({
  userAnalytics,
  isLoading,
  isError,
  days,
  onDaysChange,
}) {
  return (
    <PersonalAnalyticsSection
      userAnalytics={userAnalytics}
      isLoading={isLoading}
      isError={isError}
      kicker="My Analytics"
      title="Personal Summary"
      description="Your ticket load and completion trend in the selected period."
      headerAction={
        <AnalyticsPeriodSelect
          days={days}
          onDaysChange={onDaysChange}
          dataTestPrefix="analytics-personal"
        />
      }
    />
  );
}
