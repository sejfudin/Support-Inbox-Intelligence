import { CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export const DailyEmptyState = ({ canStart, onStart, isStarting }) => (
  <Card>
    <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
      <CalendarDays className="h-8 w-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        {canStart ? 'No daily yet for today.' : 'No daily for this date.'}
      </p>
      {canStart && (
        <Button onClick={onStart} disabled={isStarting}>
          {isStarting ? 'Starting…' : "Start today's daily"}
        </Button>
      )}
    </CardContent>
  </Card>
);
