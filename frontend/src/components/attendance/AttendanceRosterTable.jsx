import { useMemo, useState } from 'react';
import { ArrowUpDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { attendanceRateTextClass, formatCheckInDate, isCheckedInToday } from '@/helpers/attendance';

const columnsFor = (rateLabel) => [
  { key: 'name', label: 'Intern', sortable: true },
  { key: 'hub', label: 'Hub', sortable: true },
  { key: 'rate', label: rateLabel, sortable: true },
  { key: 'present', label: 'Present / working', sortable: true },
  { key: 'last', label: 'Last check-in', sortable: true },
];

function RateBar({ rate }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full rounded-full',
            rate >= 90
              ? 'bg-emerald-500'
              : rate >= 75
                ? 'bg-primary'
                : rate >= 60
                  ? 'bg-amber-500'
                  : 'bg-red-500'
          )}
          style={{ width: `${Math.min(100, rate)}%` }}
        />
      </div>
      <span className={cn('text-sm font-semibold tabular-nums', attendanceRateTextClass(rate))}>
        {rate}%
      </span>
    </div>
  );
}

/**
 * Read-only roster table (admin) showing one calendar month's
 * attendance. Rate/present/working come straight from the server (month-scoped,
 * start-date-prorated). No edit affordances by design — only interns record
 * their own attendance.
 * @param {{
 *   roster: Array<object>,
 *   rateLabel?: string,
 *   showToday?: boolean,   // the "Today" column only makes sense for the current month
 * }} props
 */
export default function AttendanceRosterTable({
  roster = [],
  rateLabel = 'Attendance',
  showToday = true,
  onSelectIntern,
}) {
  const [sort, setSort] = useState({ key: 'rate', dir: 'asc' });
  const columns = columnsFor(rateLabel);

  const toggleSort = (key) =>
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }
    );

  const rows = useMemo(
    () =>
      roster.map((row) => ({
        ...row,
        stat: {
          rate: row.attendanceRate ?? 0,
          present: row.presentDays ?? 0,
          working: row.workingDays ?? 0,
        },
      })),
    [roster]
  );

  const sorted = useMemo(() => {
    const list = [...rows];
    const dir = sort.dir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      switch (sort.key) {
        case 'name':
          return a.intern.fullname.localeCompare(b.intern.fullname) * dir;
        case 'hub':
          return a.intern.hub.localeCompare(b.intern.hub) * dir;
        case 'present':
          return (a.stat.present - b.stat.present) * dir;
        case 'last':
          return (
            (new Date(a.lastCheckIn || 0).getTime() - new Date(b.lastCheckIn || 0).getTime()) * dir
          );
        case 'rate':
        default:
          return (a.stat.rate - b.stat.rate) * dir;
      }
    });
    return list;
  }, [rows, sort]);

  const colSpan = columns.length + (showToday ? 1 : 0);

  return (
    <div className="app-panel overflow-hidden" data-test="attendance-roster-table">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-border/60 bg-muted/40">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className="px-5 py-3 font-semibold text-foreground">
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className="inline-flex items-center gap-1 hover:text-primary"
                      data-test={`attendance-sort-${col.key}`}
                    >
                      {col.label}
                      <ArrowUpDown
                        className={cn(
                          'h-3 w-3',
                          sort.key === col.key ? 'text-primary' : 'text-muted-foreground/50'
                        )}
                      />
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              ))}
              {showToday && <th className="px-5 py-3 font-semibold text-foreground">Today</th>}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={colSpan} className="px-5 py-10 text-center text-muted-foreground">
                  No interns match your filters.
                </td>
              </tr>
            )}
            {sorted.map((row) => {
              const inToday = isCheckedInToday(row.records);
              return (
                <tr
                  key={row.intern.id}
                  onClick={() => onSelectIntern?.(row.intern)}
                  className={cn(
                    'border-t border-border/60',
                    onSelectIntern && 'cursor-pointer transition-colors hover:bg-muted/40'
                  )}
                  title={onSelectIntern ? 'View attendance calendar' : undefined}
                  data-test={`attendance-roster-row-${row.intern.id}`}
                >
                  <td className="px-5 py-4">
                    <p className="font-semibold text-foreground">{row.intern.fullname}</p>
                    <p className="text-xs text-muted-foreground">{row.intern.email}</p>
                  </td>
                  <td className="px-5 py-4 text-muted-foreground">{row.intern.hub}</td>
                  <td className="px-5 py-4">
                    <RateBar rate={row.stat.rate} />
                  </td>
                  <td className="px-5 py-4 tabular-nums text-muted-foreground">
                    {row.stat.present} / {row.stat.working}
                  </td>
                  <td className="px-5 py-4 text-muted-foreground">
                    {formatCheckInDate(row.lastCheckIn)}
                  </td>
                  {showToday && (
                    <td className="px-5 py-4">
                      {inToday ? (
                        <Badge variant="success">Checked in</Badge>
                      ) : (
                        <Badge variant="outline">Not yet</Badge>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
