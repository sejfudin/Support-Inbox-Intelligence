import { useMemo } from 'react';
import { AnalyticsStatRow } from '@/components/analytics/AnalyticsStatCard';
import { attendanceRateTextClass, formatAttendanceRate } from '@/helpers/attendance';

const ANALYTICS_DAYS = 30;

/**
 * The profile page's KPI strip.
 *
 * Labels and hints are deliberately the same strings the analytics tab uses
 * (`PersonalAnalyticsSection`) — the numbers come from the same endpoint, and the
 * same figure under two different names on two screens is how a reader ends up
 * believing they disagree.
 *
 * An intern trades the "Total time" tile for attendance: it is the number their
 * programme is actually measured on, and it is the one metric here that is not
 * about tickets. Everyone else keeps the four ticket tiles.
 */
export function ProfileStatRow({ analytics, attendance, isIntern, isLoading }) {
  const stats = useMemo(() => {
    const summary = analytics?.summaryStats;
    const performance = analytics?.performanceMetrics;

    const ticketStats = summary
      ? [
          {
            label: 'Completed',
            value: summary.completedTickets ?? 0,
            hint: `Last ${ANALYTICS_DAYS} days`,
          },
          {
            label: 'In progress',
            value: summary.activeTickets ?? 0,
            hint: 'Assigned now',
          },
          {
            label: 'Avg cycle time',
            value: performance?.averageCycleTimeDays
              ? `${performance.averageCycleTimeDays.toFixed(2)}d`
              : '—',
            hint: `Across ${summary.completedTickets ?? 0} tickets`,
          },
        ]
      : [];

    if (!isIntern) {
      if (!summary) return [];
      return [
        ...ticketStats,
        {
          label: 'Total time',
          value: `${(performance?.totalTimeSpentHours ?? 0).toFixed(1)}h`,
          hint: 'Tracked',
        },
      ];
    }

    if (!attendance) return ticketStats;

    const rate = attendance.attendanceRate;
    const attendanceStat = {
      label: 'Attendance',
      value: formatAttendanceRate(rate) || '—',
      valueClassName: attendanceRateTextClass(rate),
      hint: `${attendance.presentDays ?? 0} of ${attendance.workingDays ?? 0} days`,
    };

    // Second, as the mockup places it — the tile an intern looks for first after
    // their ticket count.
    return [ticketStats[0], attendanceStat, ...ticketStats.slice(1)].filter(Boolean);
  }, [analytics, attendance, isIntern]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="h-[86px] animate-pulse rounded-[var(--r-card)] border border-border bg-muted/40"
          />
        ))}
      </div>
    );
  }

  return <AnalyticsStatRow stats={stats} />;
}
