import { Link } from 'react-router-dom';
import { differenceInDays, format } from 'date-fns';
import { ArrowRight, ExternalLink, FileText } from 'lucide-react';
import { SymphonyCard } from '@/components/symphony/SymphonyCard';
import { PipelineStatusBadge } from '@/components/symphony/dashboard/PipelineStatusBadge';

const URGENCY_DAYS = 60;

function daysUntil(date) {
  if (!date) return null;
  return differenceInDays(new Date(date), new Date());
}

function isUrgent(expectedEndDate) {
  const days = daysUntil(expectedEndDate);
  return days !== null && days <= URGENCY_DAYS;
}

export function PlacementBenchTable({ isPending, readyBench = [] }) {
  return (
    <SymphonyCard>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Placement bench</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ready candidates with mentor-confirmed technologies and evaluation signals.
          </p>
        </div>
        <Link
          to="/interns?status=ready"
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
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-border/60 text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-3 pr-4 font-medium">Candidate</th>
                <th className="pb-3 pr-4 font-medium">In Selection</th>
                <th className="pb-3 pr-4 font-medium">Hub</th>
                <th className="pb-3 pr-4 font-medium">Ready tech</th>
                <th className="pb-3 pr-4 font-medium">End date</th>
                <th className="pb-3 pr-4 font-medium">Eval</th>
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
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {candidate.programme?.name || '—'}
                      </p>
                    </td>
                    <td className="py-3 pr-4">
                      <PipelineStatusBadge activeRecommendation={candidate.activeRecommendation} />
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {candidate.hub?.name || '—'}
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
                          <span className="text-xs text-muted-foreground">None</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      {candidate.expectedEndDate ? (
                        <span
                          className={urgentDate ? 'symphony-date-urgent' : 'text-muted-foreground'}
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
                        ) : null}
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
  );
}
