import { PagePanel } from '@/components/PageShell';
import { getReadinessLabel } from '@/helpers/internProfile';
import { useMyDeclaredTechnologies } from '@/hooks/useMyDeclaredTechnologies';
import { cn } from '@/lib/utils';

// Highest first: the split bar fills from the left, and reading the legend top to
// bottom should follow the bar rather than run against it. The colours are the
// ones `ReadinessLevelBadge` uses on the chips beside each technology — the same
// level must not be green here and something else two columns away.
const LEVELS = [
  { value: 'ready', bar: 'bg-[hsl(var(--tone-success))]', dot: 'bg-[hsl(var(--tone-success))]' },
  { value: 'learning', bar: 'bg-[hsl(var(--tone-warning))]', dot: 'bg-[hsl(var(--tone-warning))]' },
  // Unassessed is the track showing through, so it gets no bar segment and a
  // hollow dot: nothing has happened to these yet.
  { value: 'none', bar: null, dot: 'border border-border' },
];

/**
 * How the declared list is going, in one bar: a mentor's assessments summarised
 * across every technology on it.
 *
 * Renders nothing until something is declared — an empty bar over three zeroes
 * says less than the list's own empty state already does.
 */
export function InternReadinessSummary() {
  const { declaredTechnologies, flagMap } = useMyDeclaredTechnologies();
  const total = declaredTechnologies.length;

  if (total === 0) return null;

  const counts = declaredTechnologies.reduce(
    (acc, tech) => {
      const level = flagMap[tech._id]?.level || 'none';
      acc[level] = (acc[level] || 0) + 1;
      return acc;
    },
    { ready: 0, learning: 0, none: 0 }
  );

  return (
    <PagePanel className="px-[18px] pb-[18px] pt-[15px]">
      <h2 className="app-card-title">Readiness</h2>
      <p className="mt-0.5 text-[12.5px] leading-[1.45] text-muted-foreground">
        Across your {total} declared {total === 1 ? 'technology' : 'technologies'}.
      </p>

      <div
        className="mt-3.5 flex h-1.5 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={LEVELS.map(
          ({ value }) => `${getReadinessLabel(value)}: ${counts[value]} of ${total}`
        ).join(', ')}
      >
        {LEVELS.filter((level) => level.bar && counts[level.value] > 0).map((level) => (
          <span
            key={level.value}
            className={level.bar}
            style={{ width: `${(counts[level.value] / total) * 100}%` }}
          />
        ))}
      </div>

      <ul className="mt-3 flex flex-col gap-2" aria-hidden="true">
        {LEVELS.map((level) => (
          <li key={level.value} className="flex items-center gap-2.5">
            <span className={cn('h-2 w-2 shrink-0 rounded-full', level.dot)} />
            <span className="min-w-0 flex-1 truncate text-[12.5px] text-muted-foreground">
              {getReadinessLabel(level.value)}
            </span>
            <span className="text-[12.5px] font-semibold tabular-nums text-foreground">
              {counts[level.value]}
            </span>
          </li>
        ))}
      </ul>
    </PagePanel>
  );
}
