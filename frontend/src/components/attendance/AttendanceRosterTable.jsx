import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CHIP, badgeTone } from '@/helpers/badgeTones';
import { getInitials } from '@/helpers/getInitials';
import { getAvatarColor } from '@/helpers/avatarColor';
import {
  attendanceRateFillClass,
  attendanceRateTextClass,
  formatAttendanceRate,
  hasAttendanceRate,
  formatCheckInDate,
  internStatusOnDate,
  isExemptToday,
  dayStatusLabel,
  DAY_STATUS,
} from '@/helpers/attendance';
import { DayStatusGlyph } from '@/components/attendance/dayStatusVisuals';

const columnsFor = (rateLabel) => [
  { key: 'name', label: 'Intern', sortable: true },
  { key: 'hub', label: 'Hub', sortable: true, className: 'w-[130px]' },
  { key: 'rate', label: rateLabel, sortable: true, className: 'w-[230px]' },
  { key: 'present', label: 'Present', sortable: true, className: 'w-[90px]' },
  { key: 'last', label: 'Last check-in', sortable: true, className: 'w-[130px]' },
];

// How today reads in the last column. Absent is deliberately quieter than a
// filled chip — it is the absence of an action, and a red badge on every intern
// who has not come in yet turns the column into a wall of alarm.
const TODAY_TONE = {
  [DAY_STATUS.PRESENT]: { chip: 'success', label: 'In' },
  [DAY_STATUS.REMOTE]: { chip: 'info' },
  [DAY_STATUS.VACATION]: { chip: 'info' },
  [DAY_STATUS.RELIGIOUS]: { chip: 'info' },
  [DAY_STATUS.SICK]: { chip: 'info' },
  [DAY_STATUS.TODAY_PENDING]: { chip: 'neutral', label: 'Not yet' },
};

function RateBar({ rate, exempt = false }) {
  // Nothing was owed (the intern is on a project): render an empty track and a dash
  // rather than a 0% bar, which would read as a month of absences.
  const known = hasAttendanceRate(rate);

  return (
    <div className="flex items-center gap-2.5">
      <div className="h-[6px] w-[150px] shrink-0 overflow-hidden rounded-full bg-muted">
        {known && (
          <div
            className={cn('h-full rounded-full', attendanceRateFillClass(rate))}
            style={{ width: `${Math.min(100, rate)}%` }}
          />
        )}
      </div>
      <span
        className={cn(
          'shrink-0 text-[12.5px] font-semibold tabular-nums',
          attendanceRateTextClass(rate)
        )}
      >
        {formatAttendanceRate(rate)}
      </span>
      {!known && exempt && <span className="text-[11px] text-muted-foreground/75">on project</span>}
    </div>
  );
}

function SortableHead({ col, sort, onToggle }) {
  const active = sort.key === col.key;
  const Icon = !active ? ChevronsUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;

  if (!col.sortable) return col.label;

  return (
    <button
      type="button"
      onClick={() => onToggle(col.key)}
      className={cn(
        'group inline-flex items-center gap-1.5 uppercase tracking-[0.07em] transition-colors hover:text-foreground',
        active && 'text-foreground'
      )}
      data-test={`attendance-sort-${col.key}`}
    >
      {col.label}
      {/* Faint until it is the active sort — an arrow on every header reads as
          "all of these are sorted", but hiding them entirely hides which columns
          can be sorted at all. */}
      <Icon
        className={cn(
          'h-3 w-3 shrink-0 transition-opacity',
          active ? 'opacity-100' : 'opacity-35 group-hover:opacity-70'
        )}
        aria-hidden
      />
    </button>
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
 *   nonWorkingKeys?: Set<string>,
 * }} props
 */
export default function AttendanceRosterTable({
  roster = [],
  rateLabel = 'Attendance',
  showToday = true,
  nonWorkingKeys,
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
          // Kept as null when nothing was owed — `RateBar` renders a dash, and the
          // sort below pushes these to the end instead of treating them as 0%.
          rate: row.attendanceRate ?? null,
          present: row.presentDays ?? 0,
          working: row.workingDays ?? 0,
          // Only once they have actually started — an intern whose placement
          // start date is still ahead of them keeps owing attendance, and the
          // rate beside this flag is computed on exactly that basis.
          exempt: isExemptToday(row.placedAt),
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
        default: {
          // Interns who owed nothing have no rate to rank. `null - number` coerces to
          // 0 in JS, which would sort them alongside the worst attenders — so they
          // are pinned to the end in both directions instead.
          const aHas = hasAttendanceRate(a.stat.rate);
          const bHas = hasAttendanceRate(b.stat.rate);
          if (!aHas && !bHas) return 0;
          if (!aHas) return 1;
          if (!bHas) return -1;
          return (a.stat.rate - b.stat.rate) * dir;
        }
      }
    });
    return list;
  }, [rows, sort]);

  const colSpan = columns.length + (showToday ? 1 : 0);

  return (
    <div className="app-card overflow-hidden" data-test="attendance-roster-table">
      <div className="app-table-scroll">
        <table className="w-full min-w-[860px] text-left">
          <thead>
            <tr className="app-table-head border-b border-separator">
              {columns.map((col) => (
                <th key={col.key} className={cn('px-[18px] font-semibold', col.className)}>
                  <SortableHead col={col} sort={sort} onToggle={toggleSort} />
                </th>
              ))}
              {showToday && <th className="w-[100px] px-[18px] font-semibold">Today</th>}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={colSpan}
                  className="px-[18px] py-10 text-center text-[12.5px] text-muted-foreground"
                >
                  No interns match your filters.
                </td>
              </tr>
            )}
            {sorted.map((row) => {
              // The real classification, not "is there a record today": an approved
              // remote day IS in `records`, so a naive check reports working from
              // home as an office check-in; approved leave is not in `records` at
              // all, and would otherwise read as "Not yet" — a prompt to go and
              // chase someone who is on holiday. It also tells apart a closed
              // window (Absent) from one still open (Not yet).
              const todayStatus = showToday
                ? internStatusOnDate(row, new Date(), nonWorkingKeys).status
                : null;
              const tone = TODAY_TONE[todayStatus];

              return (
                <tr
                  key={row.intern.id}
                  onClick={() => onSelectIntern?.(row.intern)}
                  className={cn(
                    'border-b border-separator last:border-b-0',
                    onSelectIntern && 'cursor-pointer transition-colors hover:bg-accent/60'
                  )}
                  title={onSelectIntern ? 'View attendance calendar' : undefined}
                  data-test={`attendance-roster-row-${row.intern.id}`}
                >
                  <td className="px-[18px] py-2.5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-[10.5px] font-bold ${getAvatarColor(
                          row.intern.fullname
                        )}`}
                        aria-hidden="true"
                      >
                        {getInitials(row.intern.fullname)}
                      </span>
                      <div className="min-w-0 leading-[1.35]">
                        <p className="truncate text-[13px] font-medium text-foreground">
                          {row.intern.fullname}
                        </p>
                        <p className="truncate text-[11.5px] text-muted-foreground/75">
                          {row.intern.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-[18px] py-2.5 text-[12.5px] text-muted-foreground">
                    {row.intern.hub}
                  </td>
                  <td className="px-[18px] py-2.5">
                    <RateBar rate={row.stat.rate} exempt={row.stat.exempt} />
                  </td>
                  <td className="px-[18px] py-2.5 text-[12.5px] tabular-nums text-muted-foreground">
                    {row.stat.present} / {row.stat.working}
                  </td>
                  <td className="px-[18px] py-2.5 text-[12.5px] text-muted-foreground">
                    {formatCheckInDate(row.lastCheckIn)}
                  </td>
                  {showToday && (
                    <td className="px-[18px] py-2.5">
                      {tone ? (
                        <span className={cn(CHIP, 'gap-1.5 border-0', badgeTone(tone.chip))}>
                          {!tone.label && <DayStatusGlyph status={todayStatus} />}
                          {tone.label ?? dayStatusLabel(todayStatus)}
                        </span>
                      ) : (
                        // Absent, weekend, before-start: no chip, just the word.
                        <span
                          className={cn(
                            'text-[12.5px] font-medium',
                            todayStatus === DAY_STATUS.ABSENT
                              ? 'text-[hsl(var(--tone-danger-fg))]'
                              : 'text-muted-foreground/75'
                          )}
                        >
                          {dayStatusLabel(todayStatus)}
                        </span>
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
