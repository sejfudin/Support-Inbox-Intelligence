import { useMemo, useState } from 'react';
import { InternPanel } from '@/components/interns/InternPanel';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useInternReadiness, useUpsertInternReadiness } from '@/queries/interns';
import { READINESS_LEVELS, getReadinessBadgeClassName } from '@/helpers/internProfile';
import { ReadinessLevelBadge } from '@/components/interns/ReadinessLevelBadge';
import { useAuth } from '@/context/AuthContext';
import { ROLES } from '@/helpers/roles';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const READINESS_PAGE_SIZE = 9;

const READINESS_SORT_ORDER = {
  ready: 0,
  learning: 1,
  none: 2,
};

const getTechnologyReadinessLevel = (technologyId, flagMap) =>
  flagMap[technologyId]?.level || 'none';

const sortTechnologiesByReadiness = (technologyList, flagMap) =>
  [...technologyList].sort((a, b) => {
    const orderA = READINESS_SORT_ORDER[getTechnologyReadinessLevel(a._id, flagMap)] ?? 2;
    const orderB = READINESS_SORT_ORDER[getTechnologyReadinessLevel(b._id, flagMap)] ?? 2;
    if (orderA !== orderB) return orderA - orderB;
    return a.name.localeCompare(b.name);
  });

export function InternReadinessPanel({ userId, declaredTechnologies = [], readOnly = false }) {
  const { user } = useAuth();
  const canWrite = !readOnly && user?.role === ROLES.ADMIN;
  const { data: flags = [], isPending } = useInternReadiness(userId);
  const { mutate } = useUpsertInternReadiness();
  const [visibleCount, setVisibleCount] = useState(READINESS_PAGE_SIZE);

  const flagMap = useMemo(
    () => Object.fromEntries(flags.map((f) => [f.technology?._id || f.technology, f])),
    [flags]
  );

  const sortedTechnologies = useMemo(
    () => sortTechnologiesByReadiness(declaredTechnologies, flagMap),
    [declaredTechnologies, flagMap]
  );

  const visibleTechnologies = useMemo(
    () => sortedTechnologies.slice(0, visibleCount),
    [sortedTechnologies, visibleCount]
  );
  const hasMoreTechnologies = visibleCount < sortedTechnologies.length;

  const handleLevelChange = (technologyId, level) => {
    if (!canWrite) return;
    mutate(
      { userId, payload: { technologyId, level } },
      {
        onSuccess: () => toast.success('Readiness updated'),
        onError: (err) => toast.error(err?.response?.data?.message || 'Failed to update readiness'),
      }
    );
  };

  return (
    <div className="h-full">
      <InternPanel className="h-full overflow-hidden p-0">
        <div className="border-b border-border/60 px-5 py-4 md:px-6">
          <h3 className="text-lg font-semibold">Placement readiness by technology</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Mentor-assessed readiness for client placement tracks.
          </p>
        </div>
        {declaredTechnologies.length === 0 && (
          <p className="px-5 py-6 text-sm text-muted-foreground md:px-6">
            This intern hasn't declared any technologies yet.
          </p>
        )}
        {isPending && declaredTechnologies.length > 0 && (
          <p className="px-5 py-6 text-sm text-muted-foreground md:px-6">Loading readiness...</p>
        )}
        {!isPending && declaredTechnologies.length > 0 && (
          <>
            <div className="grid gap-4 p-5 [grid-template-columns:repeat(auto-fill,minmax(230px,1fr))] md:p-6">
              {visibleTechnologies.map((tech) => {
                const flag = flagMap[tech._id];
                const level = flag?.level || 'none';

                return (
                  <div
                    key={tech._id}
                    className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-colors hover:bg-gray-50/70 dark:border-border/60 dark:bg-card dark:hover:bg-muted/30"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h4 className="min-w-0 truncate font-semibold text-gray-900 dark:text-foreground">
                        {tech.name}
                      </h4>
                      {canWrite ? (
                        <Select value={level} onValueChange={(v) => handleLevelChange(tech._id, v)}>
                          <SelectTrigger
                            className={cn(
                              'h-8 w-32 shrink-0 rounded-lg border px-2.5 text-xs font-semibold shadow-none',
                              getReadinessBadgeClassName(level)
                            )}
                            data-test={`intern-readiness-${tech.slug}-select`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {READINESS_LEVELS.map((r) => (
                              <SelectItem key={r.value} value={r.value}>
                                {r.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <ReadinessLevelBadge level={level} />
                      )}
                    </div>
                    <p className="text-xs text-gray-400">
                      Assessed by:{' '}
                      <span className="font-medium text-gray-500">
                        {flag?.setBy?.fullname || '—'}
                      </span>
                    </p>
                  </div>
                );
              })}
            </div>
            {hasMoreTechnologies && (
              <div className="border-t border-border/60 px-5 py-4 text-center md:px-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setVisibleCount((count) => count + READINESS_PAGE_SIZE)}
                >
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </InternPanel>
    </div>
  );
}
