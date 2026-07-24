import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

export const RANGE_OPTIONS = [
  { value: '7', label: '7 days' },
  { value: '14', label: '14 days' },
  { value: 'full', label: 'Full month' },
];

const CELL_TONE = {
  reported: 'bg-emerald-500 hover:bg-emerald-600',
  missed: 'bg-red-500 hover:bg-red-600',
};

const rateTextClass = (rate) =>
  rate >= 90
    ? 'text-emerald-600 dark:text-emerald-400'
    : rate >= 75
      ? 'text-primary'
      : rate >= 60
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400';

// A handful of columns stretch evenly across the panel with no leftover gap;
// once there are more than this many, fixed comfortable widths + horizontal
// scroll take over instead — forcing a near-full month to fill the same
// width would squeeze the day-of-week labels unreadably thin. This is based
// on the actual column count, not which range button is selected, so an
// early-month "Full month" view (naturally few columns) also fills cleanly.
const MAX_FILL_DAYS = 14;

/**
 * One row per active intern, one cell per day in the visible window (the
 * trailing 7/14 days of the selected month, or the whole month). Reported/
 * missed cells are filled rounded rectangles (not dots) and are clickable to
 * open the standup detail popup; weekend cells are a fixed, contentless
 * marker and are never clickable — a click that always resolves to "nothing
 * was expected" would be a dead affordance, not a real reporting state.
 * @param {{
 *   coverage: { days: Array<{date:string, weekend:boolean}>, people: Array },
 *   onSelectCell: (selection: object) => void,
 *   rangeOption: '7' | '14' | 'full',
 *   onRangeChange: (value: string) => void,
 * }} props
 */
export default function DailyCoverageGrid({ coverage, onSelectCell, rangeOption, onRangeChange }) {
  const allDays = coverage?.days ?? [];
  const people = coverage?.people ?? [];

  const days = useMemo(() => {
    if (rangeOption === '7') return allDays.slice(-7);
    if (rangeOption === '14') return allDays.slice(-14);
    return allDays;
  }, [allDays, rangeOption]);

  const fillContainer = days.length > 0 && days.length <= MAX_FILL_DAYS;
  const dayColPct = fillContainer ? 72 / days.length : null;

  return (
    <div className="app-panel overflow-hidden" data-test="daily-coverage-grid">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Reporting coverage
          </p>
          <p className="text-xs text-muted-foreground">Click a day for details</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <ToggleGroup
            type="single"
            value={rangeOption}
            onValueChange={(value) => value && onRangeChange(value)}
            className="justify-start gap-1 rounded-lg border border-border/70 p-1"
            data-test="daily-coverage-range-toggle"
          >
            {RANGE_OPTIONS.map((option) => (
              <ToggleGroupItem
                key={option.value}
                value={option.value}
                size="sm"
                className="px-2.5 text-xs"
                data-test={`daily-coverage-range-${option.value}`}
              >
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[3px] bg-emerald-500" /> Reported
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[3px] bg-red-500" /> Missed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[3px] bg-muted-foreground/25" /> Weekend
            </span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table
          className={cn('table-fixed text-left text-xs', fillContainer && 'w-full')}
          data-test="daily-coverage-table"
        >
          <colgroup>
            <col
              className={!fillContainer ? 'w-32' : undefined}
              style={fillContainer ? { width: '20%' } : undefined}
            />
            {days.map((day) => (
              <col
                key={day.date}
                className={!fillContainer ? 'w-8' : undefined}
                style={fillContainer ? { width: `${dayColPct}%` } : undefined}
              />
            ))}
            <col
              className={!fillContainer ? 'w-16' : undefined}
              style={fillContainer ? { width: '8%' } : undefined}
            />
          </colgroup>
          <thead className="border-b border-border/60 bg-muted/40">
            <tr>
              <th className="px-3 py-2 font-semibold text-foreground">Member</th>
              {days.map((day) => {
                const parsed = parseISO(day.date);
                return (
                  <th key={day.date} className="py-2 text-center font-medium text-muted-foreground">
                    <div className="flex flex-col items-center leading-tight">
                      <span className="text-[10px] uppercase">{format(parsed, 'EEE')}</span>
                      <span className="text-xs font-semibold text-foreground">
                        {format(parsed, 'd')}
                      </span>
                    </div>
                  </th>
                );
              })}
              <th className="px-3 py-2 text-right font-semibold text-foreground">Rate</th>
            </tr>
          </thead>
          <tbody>
            {people.length === 0 && (
              <tr>
                <td
                  colSpan={days.length + 2}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  No active interns in this workspace.
                </td>
              </tr>
            )}
            {people.map((person) => (
              <tr
                key={person.id}
                className="border-t border-border/60"
                data-test={`daily-coverage-row-${person.id}`}
              >
                <td className="truncate px-3 py-1.5">
                  <p className="truncate font-semibold text-foreground" title={person.email}>
                    {person.fullname}
                  </p>
                </td>
                {days.map((day) => {
                  if (day.weekend) {
                    return (
                      <td key={day.date} className="px-0.5 py-1.5 text-center">
                        <span className="mx-auto block h-5 w-3/4 rounded-[4px] bg-muted-foreground/15" />
                      </td>
                    );
                  }
                  const status = person.cells[day.date];
                  return (
                    <td key={day.date} className="px-0.5 py-1.5 text-center">
                      <button
                        type="button"
                        title={`${format(parseISO(day.date), 'EEE, MMM d')} — ${
                          status === 'reported' ? 'Reported' : 'Missed'
                        }`}
                        onClick={() =>
                          onSelectCell({
                            memberId: person.id,
                            date: day.date,
                            fullname: person.fullname,
                          })
                        }
                        className={cn(
                          'mx-auto block h-5 w-3/4 rounded-[4px] transition-colors',
                          CELL_TONE[status]
                        )}
                        data-test={`daily-coverage-cell-${person.id}-${day.date}`}
                      />
                    </td>
                  );
                })}
                <td
                  className="px-3 py-1.5 text-right"
                  title={`${person.reportedCount}/${person.eligibleWorkingDays} days`}
                >
                  <span className={cn('font-semibold tabular-nums', rateTextClass(person.rate))}>
                    {person.rate}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
