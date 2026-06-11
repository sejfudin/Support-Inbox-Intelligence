import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { differenceInDays, format } from 'date-fns';
import { AlertTriangle, ArrowRight, ExternalLink, FileText } from 'lucide-react';
import { SymphonyCard } from '@/components/symphony/SymphonyCard';
import { SymphonyMetric } from '@/components/symphony/SymphonyMetric';
import { SymphonyPageHeader } from '@/components/symphony/SymphonyPageHeader';
import { useInternStats } from '@/queries/interns';

const URGENCY_DAYS = 60;

function BrandMetric({ label, value, hint }) {
  return (
    <SymphonyCard variant="brand">
      <SymphonyMetric label={label} value={value} hint={hint} />
    </SymphonyCard>
  );
}

function TechSupplyBar({ technology, readyCount, learningCount, maxReady }) {
  const readyWidth = maxReady > 0 ? Math.max(6, (readyCount / maxReady) * 100) : 0;
  const learningWidth =
    maxReady > 0 ? Math.max(readyCount > 0 ? 4 : 6, (learningCount / maxReady) * 100) : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="truncate font-medium">{technology?.name || 'Unknown'}</span>
        <span className="shrink-0 tabular-nums text-muted-foreground">
          {readyCount}
          {learningCount > 0 && (
            <span className="text-xs"> +{learningCount} soon</span>
          )}
        </span>
      </div>
      <div className="symphony-bar-track flex">
        {readyCount > 0 && (
          <div className="symphony-bar-fill" style={{ width: `${readyWidth}%` }} />
        )}
        {learningCount > 0 && (
          <div className="symphony-bar-fill-muted" style={{ width: `${learningWidth}%` }} />
        )}
      </div>
    </div>
  );
}

function FunnelRow({ label, count, total }) {
  const width = total > 0 ? Math.max(6, (count / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="capitalize">{label}</span>
        <span className="tabular-nums text-muted-foreground">{count}</span>
      </div>
      <div className="symphony-bar-track">
        <div className="symphony-bar-fill" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function daysUntil(date) {
  if (!date) return null;
  return differenceInDays(new Date(date), new Date());
}

function isUrgent(expectedEndDate) {
  const days = daysUntil(expectedEndDate);
  return days !== null && days <= URGENCY_DAYS;
}

export default function LeadershipDashboardPage() {
  const { data: stats, isPending, isError } = useInternStats();
  const todayLabel = format(new Date(), 'EEEE, MMMM d, yyyy');

  const technologySupply = useMemo(
    () => (stats?.technologySupply ?? []).slice(0, 8),
    [stats?.technologySupply]
  );
  const maxReady = useMemo(
    () => Math.max(1, ...technologySupply.map((row) => row.readyCount)),
    [technologySupply]
  );
  const funnelTotal = useMemo(() => {
    if (!stats?.funnel) return 0;
    return Object.values(stats.funnel).reduce((sum, count) => sum + count, 0);
  }, [stats?.funnel]);

  const summary = stats?.summary ?? {};
  const readyBench = stats?.readyBench ?? [];
  const urgent = stats?.urgent ?? [];
  const recentlyReady = stats?.recentlyReady ?? [];

  return (
    <div className="space-y-8">
      <SymphonyPageHeader
        kicker="Future Experts Programme"
        title="Programme dashboard"
        subtitle={`Placement supply, mentor-confirmed readiness, and urgency signals — ${todayLabel}.`}
      />

      {isError && (
        <SymphonyCard>
          <p className="text-sm text-destructive">Failed to load programme statistics.</p>
        </SymphonyCard>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <BrandMetric
          label="Ready for placement"
          value={isPending ? '—' : (stats?.readyForPlacement ?? 0)}
          hint="Mentor-flagged candidates available to pitch"
        />
        <BrandMetric
          label="Active interns"
          value={isPending ? '—' : (summary.activeInterns ?? 0)}
          hint="Currently active or ready in programme"
        />
        <BrandMetric
          label="Technologies with supply"
          value={isPending ? '—' : (summary.technologiesWithReadySupply ?? 0)}
          hint="Stacks with mentor-confirmed ready talent"
        />
        <BrandMetric
          label="Placed"
          value={isPending ? '—' : (summary.placedInterns ?? 0)}
          hint="Candidates successfully placed with clients"
        />
      </div>

      {urgent.length > 0 && (
        <SymphonyCard className="symphony-urgency-card">
          <div className="mb-4 flex items-start gap-3">
            <AlertTriangle className="symphony-urgency-icon mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <h2 className="symphony-urgency-title text-lg font-semibold">
                Approaching programme end
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Ready candidates with expected end within {URGENCY_DAYS} days — prioritise placement
                conversations.
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {urgent.map((candidate) => {
              const days = daysUntil(candidate.expectedEndDate);
              return (
                <Link
                  key={candidate.profileId}
                  to={`/interns/${candidate.userId}`}
                  className="symphony-urgency-row flex items-center justify-between gap-4 rounded-xl px-4 py-3 transition-colors hover:bg-muted/30"
                  data-test={`leadership-dashboard-urgent-${candidate.userId}-link`}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{candidate.fullname}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {candidate.hub?.name || '—'} ·{' '}
                      {candidate.programme?.name || '—'}
                    </p>
                  </div>
                  <span className="symphony-urgency-days shrink-0 text-sm">
                    {days !== null && days < 0
                      ? `${Math.abs(days)}d overdue`
                      : `${days}d left`}
                  </span>
                </Link>
              );
            })}
          </div>
        </SymphonyCard>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.5fr_0.85fr]">
        <SymphonyCard>
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Placement bench</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Ready candidates with mentor-confirmed technologies and evaluation signals.
              </p>
            </div>
            <Link
              to="/interns?ready=true"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              data-test="leadership-dashboard-bench-view-all-link"
            >
              View all ready
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {isPending && <p className="text-sm text-muted-foreground">Loading placement bench...</p>}
          {!isPending && readyBench.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No candidates are flagged ready for placement yet. Check back when mentors confirm
              readiness.
            </p>
          )}
          {!isPending && readyBench.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="pb-3 pr-4 font-medium">Candidate</th>
                    <th className="pb-3 pr-4 font-medium">Hub</th>
                    <th className="pb-3 pr-4 font-medium">Programme</th>
                    <th className="pb-3 pr-4 font-medium">Ready tech</th>
                    <th className="pb-3 pr-4 font-medium">End date</th>
                    <th className="pb-3 pr-4 font-medium">Eval avg</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {readyBench.map((candidate) => {
                    const urgentDate = isUrgent(candidate.expectedEndDate);
                    return (
                      <tr key={candidate.profileId} className="align-top">
                        <td className="py-3 pr-4">
                          <Link
                            to={`/interns/${candidate.userId}`}
                            className="font-medium hover:text-primary hover:underline"
                            data-test={`leadership-dashboard-bench-${candidate.userId}-link`}
                          >
                            {candidate.fullname}
                          </Link>
                          {candidate.primaryMentor && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              Mentor: {candidate.primaryMentor.fullname}
                            </p>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {candidate.hub?.name || '—'}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {candidate.programme?.name || '—'}
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex flex-wrap gap-1">
                            {candidate.readyTechnologies?.length > 0 ? (
                              candidate.readyTechnologies.map((tech) => (
                                <span
                                  key={tech._id}
                                  className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                                >
                                  {tech.name}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground">None confirmed</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          {candidate.expectedEndDate ? (
                            <span
                              className={
                                urgentDate ? 'symphony-date-urgent' : 'text-muted-foreground'
                              }
                            >
                              {format(new Date(candidate.expectedEndDate), 'MMM d, yyyy')}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-3 pr-4 tabular-nums text-muted-foreground">
                          {candidate.latestEvaluationAverage ?? '—'}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            {candidate.cvUrl ? (
                              <a
                                href={candidate.cvUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                                data-test={`leadership-dashboard-bench-${candidate.userId}-cv-link`}
                              >
                                <FileText className="h-3.5 w-3.5" />
                                CV
                              </a>
                            ) : (
                              <span className="text-xs text-muted-foreground">No CV</span>
                            )}
                            <Link
                              to={`/interns/${candidate.userId}`}
                              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                              data-test={`leadership-dashboard-bench-${candidate.userId}-profile-link`}
                            >
                              Profile
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SymphonyCard>

        <SymphonyCard>
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">Technology supply</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Mentor-confirmed readiness by stack (ready + learning pipeline).
              </p>
            </div>
          </div>

          {isPending && <p className="text-sm text-muted-foreground">Loading supply...</p>}
          {!isPending && technologySupply.length === 0 && (
            <p className="text-sm text-muted-foreground">No mentor-confirmed technology supply yet.</p>
          )}
          {!isPending && technologySupply.length > 0 && (
            <div className="space-y-4">
              {technologySupply.map((row) => (
                <TechSupplyBar
                  key={row.technology?._id || row.technology?.slug}
                  technology={row.technology}
                  readyCount={row.readyCount}
                  learningCount={row.learningCount}
                  maxReady={maxReady}
                />
              ))}
            </div>
          )}
          <Link
            to="/interns?ready=true"
            className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            data-test="leadership-dashboard-tech-supply-link"
          >
            Browse ready candidates
            <ArrowRight className="h-4 w-4" />
          </Link>
        </SymphonyCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SymphonyCard>
          <h2 className="text-lg font-semibold">Programme funnel</h2>
          <p className="mt-1 text-sm text-muted-foreground">Distribution across lifecycle stages.</p>
          <div className="mt-4 space-y-3">
            {isPending && <p className="text-sm text-muted-foreground">Loading funnel...</p>}
            {!isPending &&
              ['active', 'ready', 'placed', 'completed', 'discontinued'].map((status) => (
                <FunnelRow
                  key={status}
                  label={status}
                  count={stats?.funnel?.[status] ?? 0}
                  total={funnelTotal}
                />
              ))}
          </div>
        </SymphonyCard>

        <div className="space-y-6">
          <SymphonyCard>
            <h2 className="text-lg font-semibold">Active by programme</h2>
            <div className="mt-4 space-y-3">
              {isPending && <p className="text-sm text-muted-foreground">Loading...</p>}
              {!isPending && (stats?.activeByProgramme ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">No active interns.</p>
              )}
              {!isPending &&
                (stats?.activeByProgramme ?? []).map((row) => (
                  <FunnelRow
                    key={row.programme?._id || 'unassigned'}
                    label={row.programme?.name || 'Unassigned'}
                    count={row.count}
                    total={summary.activeInterns || 1}
                  />
                ))}
            </div>
          </SymphonyCard>

          <SymphonyCard>
            <h2 className="text-lg font-semibold">Active by hub</h2>
            <div className="mt-4 space-y-3">
              {isPending && <p className="text-sm text-muted-foreground">Loading...</p>}
              {!isPending && (stats?.activeByHub ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">No hub data.</p>
              )}
              {!isPending &&
                (stats?.activeByHub ?? []).map((row) => (
                  <FunnelRow
                    key={row.hub?._id || 'unassigned'}
                    label={row.hub?.name || 'Unassigned'}
                    count={row.count}
                    total={summary.activeInterns || 1}
                  />
                ))}
            </div>
          </SymphonyCard>
        </div>
      </div>

      <SymphonyCard>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Recently ready</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Latest candidates flagged ready for placement.
            </p>
          </div>
          <Link
            to="/interns?ready=true"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            data-test="leadership-dashboard-recently-ready-link"
          >
            View all
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {isPending && <p className="text-sm text-muted-foreground">Loading...</p>}
        {!isPending && recentlyReady.length === 0 && (
          <p className="text-sm text-muted-foreground">No recently ready candidates.</p>
        )}
        {!isPending && recentlyReady.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {recentlyReady.map((candidate) => (
              <Link
                key={candidate.profileId}
                to={`/interns/${candidate.userId}`}
                className="rounded-xl border border-border/60 px-4 py-3 transition-colors hover:bg-muted/30"
                data-test={`leadership-dashboard-recent-${candidate.userId}-link`}
              >
                <p className="truncate font-medium">{candidate.fullname}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {candidate.hub?.name || '—'} · {candidate.programme?.name || '—'}
                </p>
                {candidate.readySince && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Updated {format(new Date(candidate.readySince), 'MMM d, yyyy')}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </SymphonyCard>
    </div>
  );
}
