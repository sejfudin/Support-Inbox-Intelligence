'use client';

import * as React from 'react';
import {
  addMonths,
  format,
  getDay,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const toDateValue = (date) => format(date, 'yyyy-MM-dd');

function buildCalendarDays(monthDate) {
  const monthStart = startOfMonth(monthDate);
  const leadingDays = getDay(monthStart);
  const days = [];

  for (let index = 0; index < leadingDays; index += 1) {
    days.push(null);
  }

  let cursor = monthStart;
  while (isSameMonth(cursor, monthStart)) {
    days.push(cursor);
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
  }

  return days;
}

/**
 * @param {object} props
 * @param {string} props.value - the selected day as 'yyyy-MM-dd', or '' for none
 * @param {(value: string) => void} props.onChange
 * @param {(day: Date) => boolean} [props.isDateDisabled]
 * @param {string[]} [props.selectedDates] - extra days to render as chosen. For
 *   multi-select callers, which keep the real selection themselves: `value` holds
 *   only one day, so without this every day but the last reads as unselected.
 * @param {boolean} [props.closeOnSelect=true] - pass false when picking is
 *   repeated (multi-select), so the calendar does not have to be re-opened
 *   between clicks.
 * @param {string} [props.triggerLabel] - overrides the trigger's text. Multi-select
 *   callers show a count or their own summary there instead of one date.
 */
export function DatePicker({
  id,
  value,
  onChange,
  placeholder = 'Pick a date',
  className,
  isDateDisabled,
  selectedDates,
  closeOnSelect = true,
  triggerLabel,
  ...props
}) {
  const selectedDate = value ? parseISO(value) : null;
  const selectedKeys = React.useMemo(() => new Set(selectedDates || []), [selectedDates]);
  const [open, setOpen] = React.useState(false);
  const [month, setMonth] = React.useState(selectedDate || new Date());
  const days = buildCalendarDays(month);

  React.useEffect(() => {
    if (selectedDate) setMonth(selectedDate);
  }, [value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className={cn(
            'h-10 w-full justify-start text-left font-normal',
            !selectedDate && 'text-muted-foreground',
            className
          )}
          {...props}
        >
          <CalendarDays className="h-4 w-4" aria-hidden="true" />
          {triggerLabel || (selectedDate ? format(selectedDate, 'MMM d, yyyy') : placeholder)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <div className="mb-3 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setMonth((currentMonth) => subMonths(currentMonth, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <p className="text-sm font-semibold text-foreground">{format(month, 'MMMM yyyy')}</p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setMonth((currentMonth) => addMonths(currentMonth, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
          {weekDays.map((day) => (
            <div key={day} className="py-1 font-medium">
              {day}
            </div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {days.map((day, index) => {
            if (!day) return <div key={`empty-${index}`} className="h-8" />;
            const key = toDateValue(day);
            const disabled = typeof isDateDisabled === 'function' && isDateDisabled(day);
            const isSelected =
              selectedKeys.has(key) || Boolean(selectedDate && isSameDay(day, selectedDate));
            return (
              <button
                key={key}
                type="button"
                disabled={disabled}
                aria-disabled={disabled || undefined}
                aria-pressed={selectedKeys.size > 0 ? isSelected : undefined}
                className={cn(
                  'flex h-8 items-center justify-center rounded-md text-sm transition-colors',
                  disabled
                    ? 'cursor-not-allowed text-muted-foreground/30'
                    : 'hover:bg-primary/10 hover:text-primary',
                  // A selected day still reads as selected when it is also disabled
                  // — multi-select callers disable the rest once the cap is reached,
                  // and greying out the user's own picks would be nonsense.
                  isSelected &&
                    'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground'
                )}
                onClick={() => {
                  if (disabled) return;
                  onChange(key);
                  if (closeOnSelect) setOpen(false);
                }}
              >
                {format(day, 'd')}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
