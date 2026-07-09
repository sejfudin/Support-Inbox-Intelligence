import { SymphonyCard } from '@/components/symphony/SymphonyCard';
import { FunnelRow } from '@/components/symphony/dashboard/FunnelRow';
import { getInternStatusLabel, INTERN_STATUSES } from '@/helpers/internProfile';

export function ProgrammeBreakdown({
  isPending,
  funnel = {},
  funnelTotal,
  activeByProgramme = [],
  activeByHub = [],
  activeInterns = 0,
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <SymphonyCard>
        <h2 className="text-lg font-semibold">Programme funnel</h2>
        <p className="mt-1 text-sm text-muted-foreground">Distribution across lifecycle stages.</p>
        <div className="mt-4 space-y-3">
          {isPending && <p className="text-sm text-muted-foreground">Loading funnel...</p>}
          {!isPending &&
            INTERN_STATUSES.map(({ value }) => (
              <FunnelRow
                key={value}
                label={getInternStatusLabel(value)}
                count={funnel[value] ?? 0}
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
            {!isPending && activeByProgramme.length === 0 && (
              <p className="text-sm text-muted-foreground">No active interns.</p>
            )}
            {!isPending &&
              activeByProgramme.map((row) => (
                <FunnelRow
                  key={row.programme?._id || 'unassigned'}
                  label={row.programme?.name || 'Unassigned'}
                  count={row.count}
                  total={activeInterns || 1}
                />
              ))}
          </div>
        </SymphonyCard>

        <SymphonyCard>
          <h2 className="text-lg font-semibold">Active by hub</h2>
          <div className="mt-4 space-y-3">
            {isPending && <p className="text-sm text-muted-foreground">Loading...</p>}
            {!isPending && activeByHub.length === 0 && (
              <p className="text-sm text-muted-foreground">No hub data.</p>
            )}
            {!isPending &&
              activeByHub.map((row) => (
                <FunnelRow
                  key={row.hub?._id || 'unassigned'}
                  label={row.hub?.name || 'Unassigned'}
                  count={row.count}
                  total={activeInterns || 1}
                />
              ))}
          </div>
        </SymphonyCard>
      </div>
    </div>
  );
}
