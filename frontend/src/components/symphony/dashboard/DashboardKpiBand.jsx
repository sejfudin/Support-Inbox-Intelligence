import { SymphonyCard } from '@/components/symphony/SymphonyCard';
import { cn } from '@/lib/utils';

function DashboardStat({ label, value, hint, primary = false }) {
  return (
    <div className={cn(primary && 'symphony-dashboard-stat-primary')}>
      <p className="symphony-dashboard-stat-label">{label}</p>
      <p className="symphony-dashboard-stat-value">{value}</p>
      {hint && <p className="symphony-dashboard-stat-hint">{hint}</p>}
    </div>
  );
}

function KpiPanel({ title, children, testId }) {
  return (
    <SymphonyCard variant="brand" className="symphony-dashboard-kpi-panel" data-test={testId}>
      <p className="symphony-dashboard-kpi-title">{title}</p>
      {children}
    </SymphonyCard>
  );
}

export function DashboardKpiBand({ isPending, stats, summary, funnel }) {
  const dash = '—';
  const ready = isPending ? dash : (stats?.readyForPlacement ?? 0);
  const unpitched = isPending ? dash : (summary?.readyWithoutActiveRecommendation ?? 0);
  const inPipeline = isPending ? dash : (summary?.activeRecommendations ?? 0);
  const interviewing = isPending ? dash : (summary?.interviewingCount ?? 0);
  const placed = isPending ? dash : (funnel?.placed ?? summary?.placedInterns ?? 0);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <KpiPanel title="Pitch-ready supply" testId="leadership-dashboard-kpi-supply-panel">
        <div className="grid gap-6 sm:grid-cols-2">
          <DashboardStat
            primary
            label="Ready for placement"
            value={ready}
            hint="Mentor-flagged candidates available to pitch"
          />
          <DashboardStat
            label="Unpitched ready"
            value={unpitched}
            hint="Ready with no active recommendation"
          />
        </div>
      </KpiPanel>

      <KpiPanel title="Selection progress" testId="leadership-dashboard-kpi-pipeline-panel">
        <div className="grid gap-6 sm:grid-cols-3">
          <DashboardStat
            primary
            label="In Selection"
            value={inPipeline}
            hint="Recommended or interviewing"
          />
          <DashboardStat
            label="Interviewing"
            value={interviewing}
            hint="Active interview processes"
          />
          <DashboardStat label="Placed" value={placed} hint="Successfully placed in programme" />
        </div>
      </KpiPanel>
    </div>
  );
}
