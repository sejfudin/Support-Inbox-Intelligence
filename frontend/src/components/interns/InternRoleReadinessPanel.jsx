import { useMemo } from 'react';
import { InternPanel } from '@/components/interns/InternPanel';
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

export function InternRoleReadinessPanel({ userId, declaredPosition = null, readOnly = false }) {
  const { user } = useAuth();
  const canWrite = !readOnly && user?.role === ROLES.ADMIN;
  const { data: flags = [], isPending } = useInternReadiness(userId);
  const { mutate } = useUpsertInternReadiness();

  // Only the flag assessed for the currently declared role counts — a flag
  // left over from a previous role reads as "Not assessed".
  const positionFlag = useMemo(
    () =>
      flags.find((f) => f.position && (f.position?._id || f.position) === declaredPosition?._id),
    [flags, declaredPosition]
  );
  const level = positionFlag?.level || 'none';

  const handleLevelChange = (nextLevel) => {
    if (!canWrite || !declaredPosition?._id) return;
    mutate(
      { userId, payload: { positionId: declaredPosition._id, level: nextLevel } },
      {
        onSuccess: () => toast.success('Readiness updated'),
        onError: (err) => toast.error(err?.response?.data?.message || 'Failed to update readiness'),
      }
    );
  };

  return (
    <InternPanel className="h-full overflow-hidden p-0 md:p-0">
      <div className="border-b border-border/60 px-5 py-4 md:px-6">
        <h3 className="text-lg font-semibold">Placement readiness by role</h3>
        <p className="mt-1 truncate text-sm text-muted-foreground">
          Mentor-assessed role readiness.
        </p>
      </div>
      {!declaredPosition && (
        <p className="px-5 py-6 text-sm text-muted-foreground md:px-6">
          This intern hasn't declared a role yet.
        </p>
      )}
      {isPending && declaredPosition && (
        <p className="px-5 py-6 text-sm text-muted-foreground md:px-6">Loading readiness...</p>
      )}
      {!isPending && declaredPosition && (
        <div className="p-5 md:p-6">
          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-colors hover:bg-gray-50/70 dark:border-border/60 dark:bg-card dark:hover:bg-muted/30">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h4 className="min-w-0 font-semibold leading-8 text-gray-900 dark:text-foreground">
                {declaredPosition.name}
              </h4>
              {canWrite ? (
                <Select value={level} onValueChange={handleLevelChange}>
                  <SelectTrigger
                    className={cn(
                      'h-8 w-32 shrink-0 rounded-lg border px-2.5 text-xs font-semibold shadow-none',
                      getReadinessBadgeClassName(level)
                    )}
                    data-test={`intern-role-readiness-${declaredPosition.slug}-select`}
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
            <p className="text-xs text-muted-foreground/70">
              Assessed by:{' '}
              <span className="font-medium text-muted-foreground">
                {positionFlag?.setBy?.fullname || '—'}
              </span>
            </p>
          </div>
        </div>
      )}
    </InternPanel>
  );
}
