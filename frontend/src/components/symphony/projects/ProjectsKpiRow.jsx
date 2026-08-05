import { useState } from 'react';
import { KpiCard } from '@/components/symphony/dashboard/KpiCard';
import { SymphonyCard } from '@/components/symphony/SymphonyCard';
import { InternsPlacedModal } from './InternsPlacedModal';
import { InSelectionModal } from './InSelectionModal';
import { SkillsInSelectionModal } from './SkillsInSelectionModal';
import { getProjectStatusLabel, SKILL_BAR_PALETTE } from '@/helpers/projects';
import { cn } from '@/lib/utils';

// Same status vocabulary as SymphonyStatusBadge/getProjectStatusLabel, given
// its own color identity here — each row is a soft colored pill (label and
// count both tinted) so a row reads as one unit rather than needing an
// underline to tie the two together.
const STATUS_ROW_TONE = {
  active: {
    dot: 'bg-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-500/[0.07] hover:bg-emerald-500/[0.13] dark:bg-emerald-500/10 dark:hover:bg-emerald-500/[0.16]',
    activeBg: 'bg-emerald-500/[0.16] dark:bg-emerald-500/[0.22]',
  },
  on_hold: {
    dot: 'bg-amber-500',
    text: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-500/[0.07] hover:bg-amber-500/[0.13] dark:bg-amber-500/10 dark:hover:bg-amber-500/[0.16]',
    activeBg: 'bg-amber-500/[0.16] dark:bg-amber-500/[0.22]',
  },
  completed: {
    dot: 'bg-slate-400',
    text: 'text-slate-600 dark:text-slate-400',
    bg: 'bg-slate-400/[0.08] hover:bg-slate-400/[0.14] dark:bg-slate-400/10 dark:hover:bg-slate-400/[0.16]',
    activeBg: 'bg-slate-400/[0.18] dark:bg-slate-400/[0.24]',
  },
};

function StatusBreakdownRow({ status, label, count, active, onClick }) {
  const tone = STATUS_ROW_TONE[status] ?? STATUS_ROW_TONE.completed;
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={cn(
        'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors',
        active ? tone.activeBg : tone.bg
      )}
    >
      <span className={cn('inline-flex items-center gap-1.5 font-semibold', tone.text)}>
        <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', tone.dot)} />
        {label}
      </span>
      <span className={cn('font-bold tabular-nums', tone.text)}>{count}</span>
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
            top4.map((skill, index) => {
              const color = SKILL_BAR_PALETTE[index % SKILL_BAR_PALETTE.length];
              return (
                <div key={skill.technology._id} className="flex items-center gap-2">
                  <span className="w-16 shrink-0 truncate text-xs font-medium text-foreground">
                    {skill.technology.name}
                  </span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${Math.max(8, (skill.internCount / max) * 100)}%`,
                        backgroundColor: color,
                      }}
                    />
                  </span>
                  <span
                    className="w-4 shrink-0 text-right text-xs font-bold tabular-nums"
                    style={{ color }}
                  >
                    {skill.internCount}
                  </span>
                </div>
              );
            })}
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
                    status={status}
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
