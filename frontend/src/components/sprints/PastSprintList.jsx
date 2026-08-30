import { format } from 'date-fns';
import { CalendarCheck, ChevronRight } from 'lucide-react';
import EmptyState from '@/components/EmptyState';

// A past sprint is a record, not a workspace — so this is a list of records:
// a name, when it ran, and what it finished. Nothing on a row is an action on
// the sprint; the only thing a row does is open its board to be read.
//
// Every number here is SEALED (ADR 0012): it was written onto the sprint the
// first time the sprint was read after its end date, so carrying a leftover out
// of it afterwards cannot quietly improve its record. The screen renders them
// and computes none of them, exactly as the live strip does.

const plural = (count, singular, pluralForm = `${singular}s`) =>
  `${count} ${count === 1 ? singular : pluralForm}`;

// The year is spelled out here where the live header band leaves it off. The
// Sprint tab shows one sprint that is running now, so the year is never in
// question; the Past tab is a list that will eventually cross a new year, and
// "Sep 1 – Sep 12" in a list of four years of sprints says nothing.
const formatPastRange = (start, end) =>
  `${format(new Date(start), 'MMM d')} – ${format(new Date(end), 'MMM d, yyyy')}`;

const PastSprintRow = ({ sprint, onOpen }) => {
  const { progress } = sprint;
  const points = progress?.points;
  const tickets = progress?.tickets;

  return (
    <button
      type="button"
      onClick={() => onOpen(sprint._id)}
      data-test={`past-sprint-${sprint._id}-row`}
      className="app-card flex w-full items-center gap-4 px-[18px] py-[15px] text-left transition-colors hover:border-border hover:bg-accent/40"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[length:var(--fs-row-title)] font-semibold text-foreground">
          {sprint.name}
        </span>
        <span className="truncate text-[length:var(--fs-hint)] text-muted-foreground">
          {[formatPastRange(sprint.start, sprint.end), sprint.goal].filter(Boolean).join(' · ')}
        </span>
      </span>

      {progress ? (
        <span className="flex shrink-0 items-baseline gap-2.5">
          <span
            className="text-[19px] font-semibold leading-none tracking-[-0.02em] text-foreground"
            data-test={`past-sprint-${sprint._id}-percent`}
          >
            {progress.percent}%
          </span>
          <span className="hidden text-[length:var(--fs-hint)] text-muted-foreground sm:inline">
            {plural(points.done, 'pt')} of {plural(points.total, 'pt')} ·{' '}
            {plural(tickets.total, 'ticket')}
          </span>
        </span>
      ) : null}

      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/75" aria-hidden />
    </button>
  );
};

// `sprints` arrives newest first from the page — the ordering is a rule the page
// owns, not something a list component should re-decide.
const PastSprintList = ({ sprints, onOpen }) => {
  if (!sprints.length) {
    return (
      <EmptyState
        icon={CalendarCheck}
        title="No past sprints yet"
        description="A sprint moves here on the day after it ends, with the numbers it finished on."
      />
    );
  }

  return (
    <div className="flex flex-col gap-2" data-test="past-sprint-list">
      {sprints.map((sprint) => (
        <PastSprintRow key={sprint._id} sprint={sprint} onOpen={onOpen} />
      ))}
    </div>
  );
};

export { PastSprintList };
