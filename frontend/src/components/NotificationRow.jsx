import { formatDistanceToNow } from "date-fns";
import { Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getTicketIdFromNotification, isMongoId } from "@/helpers/notificationUtils";

export function NotificationRow({ notification, markReadPending, onMarkRead, onOpenTicket }) {
  const ticketId = getTicketIdFromNotification(notification);
  const created = notification.createdAt ? new Date(notification.createdAt) : null;
  const timeLabel =
    created && !Number.isNaN(created.getTime())
      ? formatDistanceToNow(created, { addSuffix: true })
      : "";

  return (
    <li
      className={cn(
        "px-3 py-2.5 transition-colors",
        !notification.read ? "bg-primary/5" : "bg-transparent",
      )}
    >
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium leading-snug text-foreground">{notification.title}</p>
        {notification.body ? (
          <p className="line-clamp-2 text-xs text-muted-foreground">{notification.body}</p>
        ) : null}
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {timeLabel ? (
            <span className="text-[10px] text-muted-foreground">{timeLabel}</span>
          ) : null}
          <div className="ml-auto flex flex-wrap items-center gap-1">
            {!notification.read ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
                disabled={markReadPending}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onMarkRead(notification._id);
                }}
              >
                <Check className="h-3 w-3" />
                Read
              </Button>
            ) : null}
            {isMongoId(String(ticketId)) ? (
              <Button
                type="button"
                variant="default"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
                onClick={(e) => {
                  e.preventDefault();
                  onOpenTicket(String(ticketId));
                }}
              >
                <ExternalLink className="h-3 w-3" />
                Open task
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}
