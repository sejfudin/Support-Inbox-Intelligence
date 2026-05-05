import { Clock } from 'lucide-react';
import { formatDuration } from '@/helpers/formatDuration';

export const TimeSpent = ({ ticket }) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
          Time Spent
        </span>
      </div>
      <div className="flex min-h-[44px] items-center gap-2 px-1.5 py-2">
        {ticket?.status?.toLowerCase() === 'in progress' && (
          <span
            className="inline-flex h-2 w-2 rounded-full bg-blue-500 animate-pulse"
            title="In progress timer active"
          />
        )}
        <span className="text-base font-semibold text-gray-900">
          {(() => {
            let seconds = ticket?.totalTimeSpent || 0;
            if (ticket?.status?.toLowerCase() === 'in progress' && ticket?.inProgressAt) {
              const now = new Date();
              const inProgressAt = new Date(ticket.inProgressAt);
              seconds += Math.max(0, Math.floor((now - inProgressAt) / 1000));
            }
            return formatDuration(seconds);
          })()}
        </span>
      </div>
    </div>
  );
};

export default TimeSpent;
