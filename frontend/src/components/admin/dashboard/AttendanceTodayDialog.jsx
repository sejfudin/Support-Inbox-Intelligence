import { CalendarOff, CalendarPlus, Check, Hourglass, House, Stethoscope, Sun } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Loader, useLoaderHold } from '@/components/ui/loader';
import { useTodayAttendance } from '@/queries/attendance';
import { cn } from '@/lib/utils';

/**
 * "Attendance today" from the dashboard — who is in, who is away and why, who has
 * not checked in.
 *
 * **Platform-wide, unlike every other card on this board.** An intern is in the
 * office or not regardless of which workspace an admin happens to be looking at,
 * so this reads `GET /api/attendance/today` rather than the workspace-scoped
 * dashboard payload. Fetched when the dialog opens: nobody pays for it until they
 * ask the question.
 *
 * **Every state is named rather than folded into present/absent**, because an
 * admin acts differently on each. Approved leave in particular is neither: going
 * after somebody whose vacation you signed yourself is the exact mistake this
 * split exists to prevent — which is why the group says *vacation*, *religious
 * holiday* or *sick*, not just "away".
 */

const GROUPS = [
  {
    status: 'present',
    label: 'In the office',
    icon: Check,
    tone: 'text-[hsl(var(--tone-positive-fg))] bg-[hsl(var(--tone-positive)/0.18)]',
    // Only the two groups an admin is actually looking for say anything when
    // empty. "Nobody is on sick leave" is not news.
    empty: 'Nobody has checked in yet.',
  },
  {
    status: 'remote',
    label: 'Working remotely',
    icon: House,
    tone: 'text-primary bg-primary/15',
    empty: null,
  },
  {
    status: 'vacation',
    label: 'On vacation',
    icon: Sun,
    tone: 'text-[hsl(var(--tone-info-fg))] bg-[hsl(var(--tone-info)/0.18)]',
    empty: null,
  },
  {
    status: 'religious',
    label: 'Religious holiday',
    icon: CalendarPlus,
    tone: 'text-[hsl(var(--tone-info-fg))] bg-[hsl(var(--tone-info)/0.18)]',
    empty: null,
  },
  {
    status: 'sick',
    label: 'Sick day',
    icon: Stethoscope,
    tone: 'text-[hsl(var(--tone-danger-fg))] bg-[hsl(var(--tone-danger)/0.15)]',
    empty: null,
  },
  {
    status: 'not-started',
    label: 'Not started yet',
    icon: Hourglass,
    tone: 'text-muted-foreground bg-muted',
    empty: null,
  },
  {
    status: 'absent',
    label: 'Not checked in',
    icon: CalendarOff,
    tone: 'text-[hsl(var(--tone-warning-fg))] bg-[hsl(var(--tone-warning)/0.18)]',
    empty: 'Everyone is accounted for.',
  },
];

function PersonRow({ intern }) {
  const secondary = [intern.position, intern.hub].filter(Boolean).join(' · ') || intern.email;

  return (
    <li className="flex items-center gap-2.5 rounded-[var(--r-tile)] px-2 py-1.5 hover:bg-accent/50">
      <UserAvatar
        user={intern}
        name={intern.fullname}
        className="h-7 w-7 text-[10px]"
        showTitle={false}
      />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-[12.5px] font-medium text-foreground">
          {intern.fullname}
        </span>
        <span className="truncate text-[11px] text-muted-foreground">{secondary}</span>
      </span>
    </li>
  );
}

export function AttendanceTodayDialog({ open, onClose }) {
  const { data, isPending: isPendingRaw, isError } = useTodayAttendance({ enabled: open });
  const isPending = useLoaderHold(isPendingRaw && open, { release: isError });

  const interns = data?.interns ?? [];
  const present = interns.filter((intern) => intern.status === 'present').length;
  const owed = interns.filter(
    (intern) => intern.status !== 'not-started' && intern.status !== 'absent'
  ).length;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Attendance today</DialogTitle>
          <DialogDescription>
            {data?.label ? `${data.label} · ` : ''}
            {interns.length === 0
              ? 'no interns in the programme'
              : `${present} of ${interns.length} interns in the office, ${owed} accounted for`}
          </DialogDescription>
        </DialogHeader>

        {/* On a cohort holiday or a weekend nobody owes attendance, and a screen
            full of "not checked in" would otherwise read as a catastrophe. */}
        {data?.nonWorkingDay && (
          <p className="rounded-[var(--r-tile)] bg-muted px-3 py-2 text-[12px] text-muted-foreground">
            Today is a non-working day
            {data.nonWorkingDay.label ? `: ${data.nonWorkingDay.label}` : ''}. Nobody owes
            attendance.
          </p>
        )}
        {!data?.nonWorkingDay && data?.isWeekend && (
          <p className="rounded-[var(--r-tile)] bg-muted px-3 py-2 text-[12px] text-muted-foreground">
            It is the weekend — nobody owes attendance today.
          </p>
        )}

        {isPending && <Loader size="sm" className="py-8" label="Loading attendance…" />}

        {isError && !isPending && (
          <p className="py-8 text-center text-[12.5px] text-[hsl(var(--tone-danger-fg))]">
            Could not load today&apos;s attendance.
          </p>
        )}

        {!isPending && !isError && (
          <div className="max-h-[55vh] space-y-4 overflow-y-auto">
            {GROUPS.map((group) => {
              const people = interns.filter((intern) => intern.status === group.status);
              if (people.length === 0 && !group.empty) return null;

              return (
                <section key={group.status} data-test={`attendance-today-${group.status}`}>
                  <h3 className="flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    <span
                      className={cn(
                        'inline-flex h-5 w-5 items-center justify-center rounded-full',
                        group.tone
                      )}
                    >
                      <group.icon className="h-3 w-3" />
                    </span>
                    {group.label}
                    <span className="tabular-nums">{people.length}</span>
                  </h3>

                  {people.length === 0 ? (
                    <p className="mt-1 px-2 text-[12px] text-muted-foreground">{group.empty}</p>
                  ) : (
                    <ul className="mt-1 space-y-0.5">
                      {people.map((intern) => (
                        <PersonRow key={intern.id} intern={intern} />
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
