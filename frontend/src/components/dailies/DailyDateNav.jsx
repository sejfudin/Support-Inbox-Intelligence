import { format, isToday } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// A dot on an arrow means the history endpoint (GET /api/dailies/history) has a
// recorded daily for that neighboring date — a hint for where browsing will land.
const NavButton = ({ hasRecord, children, className, ...props }) => (
  <div className="relative">
    <button
      type="button"
      className={cn(
        'flex h-[30px] w-[30px] items-center justify-center rounded-[var(--r-control)] border border-separator text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40',
        className
      )}
      {...props}
    >
      {children}
    </button>
    {hasRecord && (
      <span className="pointer-events-none absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
    )}
  </div>
);

/**
 * The mockup's daily header row: the date and its scribe on the left, the day
 * stepper on the right. The page heading already says "Dailies", so this dropped
 * the second `<h1>Daily standup</h1>` and the Today/date badge that restated the
 * date sitting right beside them.
 */
export const DailyDateNav = ({
  date,
  scribeName,
  onPrev,
  onNext,
  onToday,
  hasPrevRecord = false,
  hasNextRecord = false,
  actions,
}) => {
  const today = isToday(date);

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 flex-wrap items-center gap-2.5">
        <span className="text-[13.5px] font-semibold text-foreground">
          {format(date, 'EEEE, MMMM d')}
        </span>
        {scribeName ? (
          <span className="text-[11.5px] text-muted-foreground/75">Scribe · {scribeName}</span>
        ) : null}
      </div>

      <div className="flex items-center gap-1.5">
        <NavButton
          hasRecord={hasPrevRecord}
          onClick={onPrev}
          aria-label="Previous day"
          data-test="daily-nav-prev"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </NavButton>
        <button
          type="button"
          onClick={onToday}
          disabled={today}
          data-test="daily-nav-today"
          className="h-[30px] rounded-[var(--r-control)] border border-separator px-3 text-[12px] text-foreground transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
        >
          Today
        </button>
        <NavButton
          hasRecord={hasNextRecord}
          onClick={onNext}
          disabled={today}
          aria-label="Next day"
          data-test="daily-nav-next"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </NavButton>
        {actions}
      </div>
    </div>
  );
};
