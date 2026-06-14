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
import { useTechnologies } from '@/queries/technologies';
import { useInternReadiness, useUpsertInternReadiness } from '@/queries/interns';
import { getReadinessLabel, READINESS_LEVELS } from '@/helpers/internProfile';
import { useAuth } from '@/context/AuthContext';
import { canWriteInternMentorData } from '@/helpers/roles';
import { toast } from 'sonner';

const READINESS_PAGE_SIZE = 9;

export function InternReadinessPanel({ userId, declaredTechnologies = [], readOnly = false }) {
  const { user } = useAuth();
  const canWrite = !readOnly && canWriteInternMentorData(user?.role);
  const { data: technologies = [] } = useTechnologies();
  const { data: flags = [], isPending } = useInternReadiness(userId);
  const { mutate } = useUpsertInternReadiness();
  const [visibleCount, setVisibleCount] = useState(READINESS_PAGE_SIZE);

  const flagMap = Object.fromEntries(flags.map((f) => [f.technology?._id || f.technology, f]));
  const visibleTechnologies = useMemo(
    () => technologies.slice(0, visibleCount),
    [technologies, visibleCount]
  );
  const hasMoreTechnologies = visibleCount < technologies.length;

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
    <div className="space-y-6">
      {declaredTechnologies.length > 0 && (
        <InternPanel>
          <h3 className="text-lg font-semibold">Declared technologies</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Technologies the intern selected on their profile.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {declaredTechnologies.map((tech) => (
              <span
                key={tech._id || tech}
                className="rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-sm font-medium"
              >
                {tech.name || tech}
              </span>
            ))}
          </div>
        </InternPanel>
      )}

      <InternPanel className="overflow-hidden p-0">
        <div className="border-b border-border/60 px-5 py-4 md:px-6">
          <h3 className="text-lg font-semibold">Placement readiness by technology</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Mentor-assessed readiness for client placement tracks.
          </p>
        </div>
        {isPending && (
          <p className="px-5 py-6 text-sm text-muted-foreground md:px-6">Loading readiness...</p>
        )}
        {!isPending && (
          <>
            <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 md:p-6 xl:grid-cols-3">
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
                        <Select
                          value={level}
                          onValueChange={(v) => handleLevelChange(tech._id, v)}
                        >
                          <SelectTrigger
                            className="h-8 w-32 shrink-0 rounded-lg border-gray-200 bg-white px-2.5 text-xs shadow-none dark:border-border/70 dark:bg-background"
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
                        <span className="shrink-0 rounded-lg border border-gray-100 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600 dark:border-border/60 dark:bg-muted/30 dark:text-muted-foreground">
                          {getReadinessLabel(level)}
                        </span>
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
