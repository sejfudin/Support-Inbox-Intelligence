import { format, parseISO } from 'date-fns';
import { CalendarDays } from 'lucide-react';
import { getInitials } from '@/helpers/getInitials';
import { getAvatarColor } from '@/helpers/avatarColor';
import { cn } from '@/lib/utils';

const PersonRow = ({ person, metaClassName, meta, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex w-full items-center gap-2.5 rounded-[var(--r-control)] px-2 py-1.5 text-left transition-colors hover:bg-muted/60"
    data-test={`daily-today-row-${person.id}`}
  >
    <div
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
        getAvatarColor(person.fullname)
      )}
    >
      {getInitials(person.fullname)}
    </div>
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-semibold text-foreground">{person.fullname}</p>
      <p className="truncate text-xs text-muted-foreground">{person.email}</p>
    </div>
    <span className={cn('shrink-0 text-xs font-medium', metaClassName)}>{meta}</span>
  </button>
);

/**
 * Today's reported vs. not-reported breakdown for a workspace's active
 * interns. Only rendered by the page when the selected month is the current
 * one — "today" has no meaning while browsing a past month.
 * @param {{ today: { date: string, isWeekend: boolean, reported: Array, missing: Array }, onSelect: (selection: object) => void }} props
 */
export default function TodayStandupCard({ today, onSelect }) {
  const reported = today?.reported ?? [];
  const missing = today?.missing ?? [];
  const total = reported.length + missing.length;

  if (today?.isWeekend) {
    return (
      <div className="app-card flex items-center gap-3 p-6 text-sm text-muted-foreground">
        <CalendarDays className="h-5 w-5 shrink-0" />
        It&rsquo;s the weekend — no standup expected today.
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="app-card p-6 text-sm text-muted-foreground">
        No active interns in this workspace yet.
      </div>
    );
  }

  const selectFor = (person) => () =>
    onSelect({ memberId: person.id, date: today.date, fullname: person.fullname });

  return (
    <div className="app-card space-y-3 p-4" data-test="daily-today-standup-card">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Today&rsquo;s standup
          </p>
          <p className="text-base font-semibold text-foreground">
            {format(parseISO(today.date), 'EEEE, MMM d')}
          </p>
        </div>
        <span className="shrink-0 text-sm font-semibold text-muted-foreground">
          {reported.length}/{total} reported
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-[var(--r-card)] border border-[hsl(var(--tone-danger)/0.2)] bg-[hsl(var(--tone-danger)/0.4)] p-3 dark:bg-[hsl(var(--tone-danger)/0.1)]">
          <p className="flex items-center gap-1.5 px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-[hsl(var(--tone-danger-fg))]">
            <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--tone-danger))]" />
            Not reported yet · {missing.length}
          </p>
          {missing.length === 0 ? (
            <p className="px-2 py-2 text-sm text-muted-foreground">Everyone has reported.</p>
          ) : (
            missing.map((person) => (
              <PersonRow
                key={person.id}
                person={person}
                metaClassName="text-[hsl(var(--tone-danger-fg))]"
                meta="No report yet"
                onClick={selectFor(person)}
              />
            ))
          )}
        </div>

        <div className="rounded-[var(--r-card)] border border-[hsl(var(--tone-success)/0.2)] bg-[hsl(var(--tone-success)/0.4)] p-3 dark:bg-[hsl(var(--tone-success)/0.1)]">
          <p className="flex items-center gap-1.5 px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-[hsl(var(--tone-success-fg))]">
            <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--tone-success))]" />
            Reported · {reported.length}
          </p>
          {reported.length === 0 ? (
            <p className="px-2 py-2 text-sm text-muted-foreground">No one has reported yet.</p>
          ) : (
            reported.map((person) => (
              <PersonRow
                key={person.id}
                person={person}
                metaClassName="text-[hsl(var(--tone-success-fg))]"
                meta={format(new Date(person.reportedAt), 'HH:mm')}
                onClick={selectFor(person)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
