import { useTimeSpentTicker } from '@/hooks/useTimeSpentTicker';
import { formatDuration } from '@/helpers/formatDuration';
import { getTicketTimeSpentSeconds, isTicketTrackingTime } from '@/helpers/ticketTimeSpent';

export const TimeSpent = ({ ticket, statusTracksTime }) => {
  const tracksTime = isTicketTrackingTime(ticket, statusTracksTime);
  useTimeSpentTicker(tracksTime ? [ticket] : [], statusTracksTime);
  const seconds = getTicketTimeSpentSeconds(ticket, statusTracksTime);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
          Time Spent
        </span>
      </div>
      <div className="flex min-h-[44px] items-center gap-2 px-1.5 py-2">
        {tracksTime && (
          <span
            className="inline-flex h-2 w-2 rounded-full bg-blue-500 animate-pulse"
            title="Timer active"
          />
        )}
        <span className="text-base font-semibold text-gray-900">{formatDuration(seconds)}</span>
      </div>
    </div>
  );
};

export default TimeSpent;
