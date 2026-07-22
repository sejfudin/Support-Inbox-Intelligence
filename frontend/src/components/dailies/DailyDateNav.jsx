import { format, isToday } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// A dot on an arrow means the history endpoint (GET /api/dailies/history) has a
// recorded daily for that neighboring date — a hint for where browsing will land.
const NavButton = ({ hasRecord, children, ...props }) => (
  <div className="relative">
    <Button variant="outline" size="icon" {...props}>
      {children}
    </Button>
    {hasRecord && (
      <span className="pointer-events-none absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
    )}
  </div>
);

export const DailyDateNav = ({
  date,
  onPrev,
  onNext,
  onToday,
  hasPrevRecord = false,
  hasNextRecord = false,
}) => {
  const today = isToday(date);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold">{format(date, 'EEEE, MMMM d, yyyy')}</h2>
        <Badge
          variant={today ? 'success' : 'outline'}
          className={cn(!today && 'text-muted-foreground')}
        >
          {today ? 'Today' : format(date, 'MMM d')}
        </Badge>
      </div>
      <div className="flex items-center gap-1">
        <NavButton
          hasRecord={hasPrevRecord}
          onClick={onPrev}
          aria-label="Previous day"
          data-test="daily-nav-prev"
        >
          <ChevronLeft className="h-4 w-4" />
        </NavButton>
        <Button
          variant="outline"
          size="sm"
          onClick={onToday}
          disabled={today}
          data-test="daily-nav-today"
        >
          Today
        </Button>
        <NavButton
          hasRecord={hasNextRecord}
          onClick={onNext}
          disabled={today}
          aria-label="Next day"
          data-test="daily-nav-next"
        >
          <ChevronRight className="h-4 w-4" />
        </NavButton>
      </div>
    </div>
  );
};
