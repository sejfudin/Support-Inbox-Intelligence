import { useMemo } from 'react';
import { parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  internStatusOnDate,
  dayStatusLabel,
  dayStatusBadgeVariant,
  formatCheckInTime,
  DAY_STATUS,
} from '@/helpers/attendance';

/**
 * Read-only per-intern attendance status for a single day (admin "By day" tab,
 * with a day picker so any weekday in the selected month can be inspected).
 * @param {{ roster: Array<object>, date: string, nonWorkingKeys?: Set<string> }} props
 *   date is 'yyyy-MM-dd'. `nonWorkingKeys` must be passed, or a public holiday
 *   reads as a cohort-wide absence here while the counts above the table — which
 *   do get it — say otherwise.
 */
const EMPTY_KEYS = new Set();

export default function DailyAttendanceTable({
  roster = [],
  date,
  onSelectIntern,
  nonWorkingKeys = EMPTY_KEYS,
}) {
  const day = useMemo(() => (date ? parseISO(date) : new Date()), [date]);

  const rows = useMemo(
    () =>
      roster
        .map((row) => ({ ...row, day: internStatusOnDate(row, day, nonWorkingKeys) }))
        .sort((a, b) => {
          // Present first, then remote, then not-yet, then absent, then non-working.
          // Remote sits beside present because it is the same verdict — the day was
          // worked — and an admin scanning the top of the list wants both together.
          const order = {
            [DAY_STATUS.PRESENT]: 0,
            [DAY_STATUS.REMOTE]: 1,
            [DAY_STATUS.TODAY_PENDING]: 2,
            [DAY_STATUS.ABSENT]: 3,
            [DAY_STATUS.FUTURE]: 4,
            [DAY_STATUS.WEEKEND]: 5,
          };
          const diff = (order[a.day.status] ?? 9) - (order[b.day.status] ?? 9);
          if (diff !== 0) return diff;
          return a.intern.fullname.localeCompare(b.intern.fullname);
        }),
    [roster, day, nonWorkingKeys]
  );

  return (
    <div className="app-panel overflow-hidden" data-test="attendance-daily-table">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-border/60 bg-muted/40">
            <tr>
              <th className="px-5 py-3 font-semibold text-foreground">Intern</th>
              <th className="px-5 py-3 font-semibold text-foreground">Hub</th>
              <th className="px-5 py-3 font-semibold text-foreground">Status</th>
              <th className="px-5 py-3 font-semibold text-foreground">Check-in time</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-muted-foreground">
                  No interns match your filters.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr
                key={row.intern.id}
                onClick={() => onSelectIntern?.(row.intern)}
                className={cn(
                  'border-t border-border/60',
                  onSelectIntern && 'cursor-pointer transition-colors hover:bg-muted/40'
                )}
                title={onSelectIntern ? 'View attendance calendar' : undefined}
                data-test={`attendance-daily-row-${row.intern.id}`}
              >
                <td className="px-5 py-4">
                  <p className="font-semibold text-foreground">{row.intern.fullname}</p>
                  <p className="text-xs text-muted-foreground">{row.intern.email}</p>
                </td>
                <td className="px-5 py-4 text-muted-foreground">{row.intern.hub}</td>
                <td className="px-5 py-4">
                  <Badge variant={dayStatusBadgeVariant(row.day.status)}>
                    {dayStatusLabel(row.day.status)}
                  </Badge>
                </td>
                <td className="px-5 py-4 tabular-nums text-muted-foreground">
                  {/* A remote day has no check-in time — its timestamp is when an
                      admin approved it, which is not an arrival. */}
                  {row.day.status === DAY_STATUS.PRESENT
                    ? formatCheckInTime(row.day.checkInTime)
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
