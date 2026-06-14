import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { SymphonyCard } from '@/components/symphony/SymphonyCard';
import { getRecommendationStatusLabel } from '@/helpers/recommendations';
import { cn } from '@/lib/utils';

function PipelineStatusPill({ status }) {
  const isInterviewing = status === 'interviewing';
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-xs font-semibold',
        isInterviewing
          ? 'border border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-300'
          : 'border border-primary/35 bg-primary/10 text-primary'
      )}
    >
      {getRecommendationStatusLabel(status)}
    </span>
  );
}

export function ActivePipelineTable({ isPending, activePipeline = [] }) {
  return (
    <SymphonyCard>
      <div className="mb-5">
        <h2 className="text-lg font-semibold">Active pipeline</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Recommendations in flight — recommended or interviewing with clients.
        </p>
      </div>

      {isPending && <p className="text-sm text-muted-foreground">Loading pipeline...</p>}
      {!isPending && activePipeline.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No active placement attempts. Ready candidates are waiting to be recommended.
        </p>
      )}
      {!isPending && activePipeline.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border/60 text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-3 pr-4 font-medium">Candidate</th>
                <th className="pb-3 pr-4 font-medium">Status</th>
                <th className="pb-3 pr-4 font-medium">Technologies</th>
                <th className="pb-3 pr-4 font-medium">Company / role</th>
                <th className="pb-3 font-medium">Next interview</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {activePipeline.map((row) => (
                <tr key={row.recommendationId} className="align-top">
                  <td className="py-3 pr-4">
                    <Link
                      to={`/interns/${row.userId}?tab=recommendations`}
                      className="font-medium hover:text-primary hover:underline"
                      data-test={`leadership-dashboard-pipeline-${row.userId}-link`}
                    >
                      {row.fullname}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {row.hub?.name || '—'}
                    </p>
                  </td>
                  <td className="py-3 pr-4">
                    <PipelineStatusPill status={row.status} />
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex flex-wrap gap-1">
                      {row.technologies?.length > 0 ? (
                        row.technologies.map((tech) => (
                          <span
                            key={tech._id}
                            className="rounded-full bg-muted/50 px-2 py-0.5 text-xs"
                          >
                            {tech.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {row.latestCompany ? (
                      <>
                        <p className="font-medium text-foreground">{row.latestCompany}</p>
                        {row.latestRole && (
                          <p className="text-xs">{row.latestRole}</p>
                        )}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-3 text-muted-foreground">
                    {row.nextInterviewAt ? (
                      format(new Date(row.nextInterviewAt), 'MMM d, yyyy')
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SymphonyCard>
  );
}
