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

export function DatePicker({
  id,
  value,
  onChange,
  placeholder = 'Pick a date',
  className,
  isDateDisabled,
  ...props
}) {
  const selectedDate = value ? parseISO(value) : null;
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
          {selectedDate ? format(selectedDate, 'MMM d, yyyy') : placeholder}
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
            const disabled = typeof isDateDisabled === 'function' && isDateDisabled(day);
            return (
              <button
                key={toDateValue(day)}
                type="button"
                disabled={disabled}
                aria-disabled={disabled || undefined}
                className={cn(
                  'flex h-8 items-center justify-center rounded-md text-sm transition-colors',
                  disabled
                    ? 'cursor-not-allowed text-muted-foreground/30'
                    : 'hover:bg-primary/10 hover:text-primary',
                  !disabled &&
                    selectedDate &&
                    isSameDay(day, selectedDate) &&
                    'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground'
                )}
                onClick={() => {
                  if (disabled) return;
                  onChange(toDateValue(day));
                  setOpen(false);
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
