import { Clock } from "lucide-react";
import { formatDuration } from "@/helpers/formatDuration";

export const TimeSpent = ({ ticket }) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
        <Clock className="w-4 h-4" /> Time Spent
      </div>
      <div className="flex min-h-[44px] items-center px-1.5">
        <span className="text-lg font-bold text-foreground">
          {(() => {
            let seconds = ticket?.totalTimeSpent || 0;
            if (
              ticket?.status?.toLowerCase() === "in progress" &&
              ticket?.inProgressAt
            ) {
              const now = new Date();
              const inProgressAt = new Date(ticket.inProgressAt);
              seconds += Math.max(0, Math.floor((now - inProgressAt) / 1000));
            }
            return formatDuration(seconds);
          })()}
        </span>
        {ticket?.status?.toLowerCase() === "in progress" && (
          <span
            className="ml-2 inline-flex h-2 w-2 rounded-full bg-blue-500 animate-pulse"
            title="In progress timer active"
          />
        )}
      </div>
    </div>
  );
};

export default TimeSpent;
