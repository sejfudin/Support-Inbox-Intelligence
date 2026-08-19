import { useMemo, useState } from 'react';
import { format } from 'date-fns';
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
import PanelBodySkeleton from '@/components/Skeletons/PanelBodySkeleton';
import { LoadingOverlay, useLoaderHold } from '@/components/ui/loader';

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
  const { data: flags = [], isPending: isPendingRaw } = useInternReadiness(userId);
  // Global hold: keeps the mark up for MIN_VISIBLE_MS once it appears, and until the data is in.
  const isPending = useLoaderHold(isPendingRaw);
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
    <InternPanel dense>
      <h3 className="app-card-title">Readiness by technology</h3>
      <p className="mt-0.5 text-[12.5px] text-muted-foreground">
        Mentor-assessed readiness for client placement tracks.
      </p>

      {declaredTechnologies.length === 0 && (
        <p className="pt-3 text-[12.5px] text-muted-foreground">
          This intern hasn't declared any technologies yet.
        </p>
      )}
      {isPending && declaredTechnologies.length > 0 && (
        <LoadingOverlay size="sm" label="Loading readiness">
          <PanelBodySkeleton
            rows={declaredTechnologies.length > 3 ? 4 : declaredTechnologies.length}
          />
        </LoadingOverlay>
      )}
      {!isPending && declaredTechnologies.length > 0 && (
        <>
          {/* Two per row, not auto-fill: the tile is a label and a chip, so it has
              no reason to grow past half the card, and a fixed pair keeps the chips
              on two predictable columns you can scan down. */}
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {visibleTechnologies.map((tech) => {
              const flag = flagMap[tech._id];
              const level = flag?.level || 'none';
              const assessedOn = flag?.updatedAt ? format(new Date(flag.updatedAt), 'MMM d') : null;
              const assessor = flag?.setBy?.fullname;

              return (
                <div
                  key={tech._id}
                  className="flex items-center justify-between gap-2.5 rounded-[var(--r-tile)] border border-separator p-[11px] px-[13px] transition-colors hover:bg-accent/60"
                >
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-[12.5px] font-medium text-foreground">
                      {tech.name}
                    </span>
                    {/* Who assessed it and when, on one line — an unassessed tile
                        shows an em dash so the row keeps its height and the chips
                        stay aligned down the column. */}
                    <span className="truncate text-[11px] text-muted-foreground/75">
                      {assessor ? `${assessor}${assessedOn ? ` · ${assessedOn}` : ''}` : '—'}
                    </span>
                  </span>
                  {canWrite ? (
                    <Select value={level} onValueChange={(v) => handleLevelChange(tech._id, v)}>
                      <SelectTrigger
                        className={cn(
                          'h-7 w-[116px] shrink-0 rounded-full border px-2.5 text-[11px] font-semibold shadow-none',
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
              );
            })}
          </div>
          {hasMoreTechnologies && (
            <div className="mt-3 border-t border-separator pt-3 text-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-[26px] rounded-[var(--r-badge)] px-2.5 text-[11.5px]"
                onClick={() => setVisibleCount((count) => count + READINESS_PAGE_SIZE)}
              >
                Load more
              </Button>
            </div>
          )}
        </>
      )}
    </InternPanel>
  );
}
