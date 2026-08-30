import { format } from 'date-fns';
import { cn } from '@/lib/utils';

// Every number on this strip is computed by the server's sprint-rules helper and
// carried on the sprint read (`progress`, `workingDays`, `needsAttention`). This
// component renders them and computes nothing — one implementation of each rule,
// on the side that owns the tickets.

const plural = (count, singular, pluralForm = `${singular}s`) =>
  `${count} ${count === 1 ? singular : pluralForm}`;

// The label sits on its own line, with `trailing` — the progress cell's big
// percentage — pushed to the right of it, as the mockup has it.
const Cell = ({ label, trailing, children, className }) => (
  <div className={cn('flex flex-col gap-1.5 px-[18px] py-[15px]', className)}>
    <div className="flex min-h-[26px] items-center justify-between gap-3">
      <span className="app-crumb">{label}</span>
      {trailing}
    </div>
    {children}
  </div>
);

const StatNumber = ({ children }) => (
  <span className="text-[26px] font-semibold leading-none tracking-[-0.02em] text-foreground">
    {children}
  </span>
);

const Detail = ({ children }) => (
  <span className="text-[length:var(--fs-hint)] text-muted-foreground">{children}</span>
);

// Done, in progress and to do laid end to end. The bar measures story POINTS
// (ADR 0011), so a finished five-pointer moves it further than a finished
// one-pointer — which is the whole reason estimates are required to join a
// sprint. An empty sprint leaves the bare track showing.
const StackedBar = ({ points, percent }) => {
  const share = (value) => (points.total ? (value / points.total) * 100 : 0);

  return (
    <div
      role="progressbar"
      aria-label="Sprint progress in story points"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      className="flex h-2 overflow-hidden rounded-[var(--r-pill)] bg-muted"
    >
      <span className="bg-primary transition-[width]" style={{ width: `${share(points.done)}%` }} />
      <span
        className="bg-primary/30 transition-[width]"
        style={{ width: `${share(points.inProgress)}%` }}
      />
    </div>
  );
};

// The mockup's legend read ticket counts beside a bar measuring points, which
// invited exactly one misreading. Every legend entry therefore says `pts`, and
// the ticket count lives in the totals on the right where it is labelled too.
const LegendEntry = ({ dotClassName, points, label }) => (
  <span className="flex items-center gap-1.5 text-[length:var(--fs-hint)] text-muted-foreground">
    <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dotClassName)} />
    {plural(points, 'pt')} {label}
  </span>
);

const SprintProgressStrip = ({ sprint }) => {
  const { progress, workingDays, needsAttention } = sprint ?? {};
  if (!progress || !workingDays || !needsAttention) return null;

  const { points, tickets, percent } = progress;

  const attentionDetail =
    needsAttention.total === 0
      ? 'Nothing blocked or overdue'
      : [
          needsAttention.blocked ? `${needsAttention.blocked} blocked` : null,
          needsAttention.overdue ? `${needsAttention.overdue} overdue` : null,
        ]
          .filter(Boolean)
          .join(' · ');

  return (
    <div
      className="app-card grid grid-cols-1 divide-y divide-separator sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] sm:divide-x sm:divide-y-0"
      data-test="sprint-progress-strip"
    >
      <Cell
        label="Sprint progress"
        trailing={
          <StatNumber>
            <span data-test="sprint-progress-percent">{percent}%</span>
          </StatNumber>
        }
      >
        <StackedBar points={points} percent={percent} />
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1">
            <LegendEntry dotClassName="bg-primary" points={points.done} label="done" />
            <LegendEntry
              dotClassName="bg-primary/30"
              points={points.inProgress}
              label="in progress"
            />
            <LegendEntry dotClassName="bg-muted-foreground/30" points={points.todo} label="to do" />
          </div>
          <Detail>
            {plural(tickets.total, 'ticket')} · {plural(points.total, 'pt')} total
          </Detail>
        </div>
      </Cell>

      <Cell label="Days left">
        <StatNumber>
          <span data-test="sprint-days-left">{workingDays.remaining}</span>
        </StatNumber>
        <Detail>
          of {plural(workingDays.total, 'working day')} · ends{' '}
          {format(new Date(sprint.end), 'MMM d')}
        </Detail>
      </Cell>

      <Cell label="Needs attention">
        <StatNumber>
          <span data-test="sprint-needs-attention">{needsAttention.total}</span>
        </StatNumber>
        <Detail>{attentionDetail}</Detail>
      </Cell>
    </div>
  );
};

export { SprintProgressStrip };
