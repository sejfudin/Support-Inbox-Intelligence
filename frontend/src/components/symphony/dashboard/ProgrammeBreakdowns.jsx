import { SymphonyCard } from '@/components/symphony/SymphonyCard';
import { BreakdownDonut } from '@/components/symphony/dashboard/BreakdownDonut';
import { INTERN_STATUSES } from '@/helpers/internProfile';

function BreakdownCard({ kicker, title, rows, emptyLabel }) {
  return (
    <SymphonyCard className="px-4 pb-[18px] pt-5 sm:px-[22px] sm:pt-[22px]">
      <p className="mb-1 text-[11px] font-semibold tracking-[0.14em] text-[hsl(var(--symphony-gold))]">
        {kicker}
      </p>
      <h3 className="mb-1.5 text-base font-semibold text-foreground">{title}</h3>
      <BreakdownDonut rows={rows} emptyLabel={emptyLabel} />
    </SymphonyCard>
  );
}

export function ProgrammeBreakdowns({
  isPending,
  funnel = {},
  activeByProgramme = [],
  activeByHub = [],
}) {
  const programmeRows = activeByProgramme
    .filter((row) => row.count > 0)
    .map((row) => ({
      name: row.programme?.name || 'Unassigned',
      value: row.count,
      href: row.programme?._id ? `/interns?internshipTypeId=${row.programme._id}` : undefined,
    }));

  const hubRows = activeByHub
    .filter((row) => row.count > 0)
    .map((row) => ({
      name: row.hub?.name || 'Unassigned',
      value: row.count,
      href: row.hub?._id ? `/interns?hubId=${row.hub._id}` : undefined,
    }));

  const stageRows = INTERN_STATUSES.map((status) => ({
    name: status,
    value: funnel[status] ?? 0,
    href: `/interns?status=${status}`,
  })).filter((row) => row.value > 0);

  return (
    <div className="space-y-4">
      <div className="px-4 sm:px-0">
        <h2 className="text-[19px] font-semibold text-foreground">Breakdowns</h2>
        <p className="mt-1 text-[13.5px] text-muted-foreground">
          Tap any group to open the candidates directory filtered to it.
        </p>
      </div>

      {isPending ? (
        <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
          {[0, 1, 2].map((i) => (
            <SymphonyCard key={i} className="px-[22px] pb-[18px] pt-[22px]">
              <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
                Loading…
              </div>
            </SymphonyCard>
          ))}
        </div>
      ) : (
        <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
          <BreakdownCard
            kicker="BY PROGRAMME"
            title="Programme mix"
            rows={programmeRows}
            emptyLabel="No active interns."
          />
          <BreakdownCard
            kicker="BY HUB"
            title="Location spread"
            rows={hubRows}
            emptyLabel="No hub data."
          />
          <BreakdownCard
            kicker="BY LIFECYCLE STAGE"
            title="Where everyone is"
            rows={stageRows}
            emptyLabel="No candidates yet."
          />
        </div>
      )}
    </div>
  );
}
