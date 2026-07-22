import { format, isToday } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const CountTile = ({ label, value }) => (
  <div className="flex flex-col items-center gap-1 rounded-xl border border-border/45 bg-card px-4 py-3">
    <span className="text-lg font-semibold leading-none">{value}</span>
    <span className="text-xs text-muted-foreground">{label}</span>
  </div>
);

export const DailyHeader = ({ date, scribeName, counts }) => {
  const today = isToday(date);
  const covered = counts?.covered ?? { present: 0, total: 0 };

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-6">
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
          {scribeName && (
            <span className="text-sm text-muted-foreground">Scribe: {scribeName}</span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <CountTile label="Team covered" value={`${covered.present}/${covered.total}`} />
          <CountTile label="Shipped" value={counts?.shipped ?? 0} />
          <CountTile label="In flight" value={counts?.inFlight ?? 0} />
          <CountTile label="Blockers" value={counts?.blockers ?? 0} />
        </div>
      </CardContent>
    </Card>
  );
};
