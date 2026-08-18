import { useMemo } from 'react';
import { format } from 'date-fns';
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
    <InternPanel dense>
      <h3 className="app-card-title">Readiness by role</h3>
      <p className="mt-0.5 text-[12.5px] text-muted-foreground">Mentor-assessed role readiness.</p>

      {!declaredPosition && (
        <p className="pt-3 text-[12.5px] text-muted-foreground">
          This intern hasn't declared a role yet.
        </p>
      )}
      {isPending && declaredPosition && (
        <p className="pt-3 text-[12.5px] text-muted-foreground">Loading readiness...</p>
      )}
      {!isPending && declaredPosition && (
        // Same tile as the technology grid, one wide — one role, so there is
        // nothing to line it up against.
        <div className="mt-3 flex items-center justify-between gap-2.5 rounded-[var(--r-tile)] border border-separator p-[11px] px-[13px] transition-colors hover:bg-accent/60">
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-[12.5px] font-medium text-foreground">
              {declaredPosition.name}
            </span>
            <span className="truncate text-[11px] text-muted-foreground/75">
              {positionFlag?.setBy?.fullname
                ? `${positionFlag.setBy.fullname}${
                    positionFlag.updatedAt
                      ? ` · ${format(new Date(positionFlag.updatedAt), 'MMM d')}`
                      : ''
                  }`
                : '—'}
            </span>
          </span>
          {canWrite ? (
            <Select value={level} onValueChange={handleLevelChange}>
              <SelectTrigger
                className={cn(
                  'h-7 w-[116px] shrink-0 rounded-full border px-2.5 text-[11px] font-semibold shadow-none',
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
      )}
    </InternPanel>
  );
}
