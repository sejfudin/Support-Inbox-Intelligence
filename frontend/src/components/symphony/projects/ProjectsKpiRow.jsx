import { useState } from 'react';
import { KpiCard } from '@/components/symphony/dashboard/KpiCard';
import { SymphonyCard } from '@/components/symphony/SymphonyCard';
import { InternsPlacedModal } from './InternsPlacedModal';
import { InSelectionModal } from './InSelectionModal';
import { SkillsInSelectionModal } from './SkillsInSelectionModal';
import { getProjectStatusLabel } from '@/helpers/projects';
import { cn } from '@/lib/utils';

function StatusBreakdownRow({ label, count, active, onClick }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={cn(
        'flex w-full items-center justify-between rounded-md px-1.5 py-1 text-left text-xs transition-colors hover:bg-muted/50',
        active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      <span>{label}</span>
      <span className="font-semibold tabular-nums text-foreground">{count}</span>
    </button>
  );
}

function SkillsInSelectionCard({ isPending, skills, internsInSelection, onClick }) {
  const top4 = skills.slice(0, 4);
  const max = Math.max(1, ...top4.map((skill) => skill.internCount));

  return (
    <button
      type="button"
      onClick={onClick}
      className="block h-full w-full text-left"
      data-test="projects-kpi-skills-button"
    >
      <SymphonyCard variant="muted" className="h-full transition-shadow hover:shadow-md">
        <p className="text-[12.5px] font-semibold text-foreground/80">Skills in selection</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {isPending
            ? 'Loading…'
            : `Across ${internsInSelection} intern${internsInSelection === 1 ? '' : 's'} in selection`}
        </p>
        <div className="mt-3.5 space-y-2">
          {!isPending && top4.length === 0 && (
            <p className="text-xs text-muted-foreground">No data yet.</p>
          )}
          {!isPending &&
            top4.map((skill) => (
              <div key={skill.technology._id} className="flex items-center gap-2">
                <span className="w-16 shrink-0 truncate text-xs font-medium text-foreground">
                  {skill.technology.name}
                </span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-[#6C63FF]"
                    style={{ width: `${Math.max(8, (skill.internCount / max) * 100)}%` }}
                  />
                </span>
                <span className="w-4 shrink-0 text-right text-xs font-semibold tabular-nums text-foreground">
                  {skill.internCount}
                </span>
              </div>
            ))}
        </div>
      </SymphonyCard>
    </button>
  );
}

/**
 * The Projects list page's 4-card KPI row. Every card is same-page
 * (filter + scroll, or open a modal) rather than navigating away, unlike
 * the programme dashboard's KpiCard usage which links to a different route.
 */
export function ProjectsKpiRow({
  isPending,
  kpis,
  statusFilter,
  onFilterStatus,
  scrollToGrid,
  scrollToChart,
}) {
  const [modal, setModal] = useState(null); // 'placed' | 'selection' | 'skills' | null
  const dash = '—';

  const byStatus = kpis?.byStatus ?? {};
  const inSelection = kpis?.inSelection ?? {};
  const skillsInSelection = kpis?.skillsInSelection ?? [];

  const handleStatusRow = (status) => {
    onFilterStatus(status);
    scrollToGrid();
  };

  return (
    <>
      <section className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]">
        <KpiCard
          label="Projects"
          value={isPending ? dash : (kpis?.totalProjects ?? 0)}
          dot="#6C63FF"
          onClick={() => {
            onFilterStatus('');
            scrollToGrid();
          }}
          testId="projects-kpi-total"
          footer={
            !isPending && (
              <div className="-mx-1.5 space-y-0.5">
                {['active', 'on_hold', 'completed'].map((status) => (
                  <StatusBreakdownRow
                    key={status}
                    label={getProjectStatusLabel(status)}
                    count={byStatus[status] || 0}
                    active={statusFilter === status}
                    onClick={() => handleStatusRow(status)}
                  />
                ))}
              </div>
            )
          }
        />
        <KpiCard
          label="Interns placed"
          value={isPending ? dash : (kpis?.internsPlaced ?? 0)}
          dot="#2FA98C"
          hint="Staffed on a client project right now"
          onClick={() => setModal('placed')}
          testId="projects-kpi-placed"
        />
        <KpiCard
          label="In selection"
          value={isPending ? dash : (inSelection.total ?? 0)}
          dot="#5B7CFA"
          hint={
            isPending
              ? undefined
              : `${inSelection.recommended || 0} recommended · ${inSelection.interviewing || 0} interviewing`
          }
          onClick={() => setModal('selection')}
          testId="projects-kpi-selection"
        />
        <SkillsInSelectionCard
          isPending={isPending}
          skills={skillsInSelection}
          internsInSelection={inSelection.internsInSelection ?? 0}
          onClick={() => setModal('skills')}
        />
      </section>

      <InternsPlacedModal
        open={modal === 'placed'}
        onOpenChange={(open) => setModal(open ? 'placed' : null)}
        interns={kpis?.placedInterns ?? []}
      />
      <InSelectionModal
        open={modal === 'selection'}
        onOpenChange={(open) => setModal(open ? 'selection' : null)}
        recommended={inSelection.recommendedInterns ?? []}
        interviewing={inSelection.interviewingInterns ?? []}
      />
      <SkillsInSelectionModal
        open={modal === 'skills'}
        onOpenChange={(open) => setModal(open ? 'skills' : null)}
        skills={skillsInSelection}
        onViewInChart={() => {
          setModal(null);
          scrollToChart();
        }}
      />
    </>
  );
}
