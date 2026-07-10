import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { SymphonyCard } from '@/components/symphony/SymphonyCard';

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
          {learningCount > 0 && <span className="text-xs"> +{learningCount} soon</span>}
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

export function TechnologySupplyCard({ isPending, technologySupply = [], maxReady }) {
  return (
    <SymphonyCard>
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Technology supply</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Mentor-confirmed readiness by stack (ready + learning pipeline).
        </p>
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
        to="/interns?status=ready"
        className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        data-test="leadership-dashboard-tech-supply-link"
      >
        Browse ready candidates
        <ArrowRight className="h-4 w-4" />
      </Link>
    </SymphonyCard>
  );
}
