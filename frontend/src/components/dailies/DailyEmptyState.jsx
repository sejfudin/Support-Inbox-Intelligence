import { CalendarDays } from 'lucide-react';

import EmptyState from '@/components/EmptyState';
import { Button } from '@/components/ui/button';

export const DailyEmptyState = ({ canStart, onStart, isStarting }) => (
  <EmptyState
    icon={CalendarDays}
    title={canStart ? 'No daily yet for today' : 'No daily for this date'}
    description={
      canStart
        ? 'Start it and everyone in the workspace can add what they worked on, what is next, and anything blocking them.'
        : 'Nothing was recorded on this date. Use the arrows above to move to a day that has a standup.'
    }
    action={
      canStart ? (
        <Button
          onClick={onStart}
          disabled={isStarting}
          className="h-[34px] rounded-[var(--r-control)] px-3.5 text-[12.5px]"
        >
          {isStarting ? 'Starting…' : "Start today's daily"}
        </Button>
      ) : null
    }
  />
);
