import { useMemo } from 'react';
import { parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import {
  internStatusOnDate,
  dayStatusLabel,
  dayStatusBadgeVariant,
  formatCheckInTime,
  DAY_STATUS,
} from '@/helpers/attendance';

/**
 * Read-only per-intern attendance status for a single day (mentor "Today" tab,
 * with a day picker so any date can be inspected).
 * @param {{ roster: Array<object>, date: string }} props - date is 'yyyy-MM-dd'
 */
export default function DailyAttendanceTable({ roster = [], date }) {
  const day = useMemo(() => (date ? parseISO(date) : new Date()), [date]);

  const rows = useMemo(
    () =>
      roster
        .map((row) => ({ ...row, day: internStatusOnDate(row, day) }))
        .sort((a, b) => {
          // Present first, then not-yet, then absent, then non-working.
          const order = {
            [DAY_STATUS.PRESENT]: 0,
            [DAY_STATUS.TODAY_PENDING]: 1,
            [DAY_STATUS.ABSENT]: 2,
            [DAY_STATUS.FUTURE]: 3,
            [DAY_STATUS.WEEKEND]: 4,
          };
          const diff = (order[a.day.status] ?? 9) - (order[b.day.status] ?? 9);
          if (diff !== 0) return diff;
          return a.intern.fullname.localeCompare(b.intern.fullname);
        }),
    [roster, day]
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
                className="border-t border-border/60"
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
