import { formatDistanceToNow } from 'date-fns';
import { Check, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  getTicketIdFromNotification,
  getCommentIdFromNotification,
  isMongoId,
} from '@/helpers/notificationUtils';

export function NotificationRow({ notification, markReadPending, onMarkRead, onOpenTicket }) {
  const ticketId = getTicketIdFromNotification(notification);
  const commentId = getCommentIdFromNotification(notification);
  const created = notification.createdAt ? new Date(notification.createdAt) : null;
  const timeLabel =
    created && !Number.isNaN(created.getTime())
      ? formatDistanceToNow(created, { addSuffix: true })
      : '';

  const isMention = notification.type === 'ticket_mention';
  const canMarkRead = !notification.read && !markReadPending && notification._id;

  const handleMarkRead = () => {
    if (!canMarkRead) return;
    onMarkRead(notification._id);
  };

  return (
    <li
      data-test={`notification-row-${notification._id}`}
      className={cn(
        'px-3 py-2.5 transition-colors',
        !notification.read ? 'cursor-pointer bg-primary/5 hover:bg-primary/10' : 'bg-transparent'
      )}
      role={canMarkRead ? 'button' : undefined}
      tabIndex={canMarkRead ? 0 : undefined}
      onClick={handleMarkRead}
      onKeyDown={(e) => {
        if (!canMarkRead || (e.key !== 'Enter' && e.key !== ' ')) return;
        e.preventDefault();
        handleMarkRead();
      }}
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium leading-snug text-foreground">{notification.title}</p>
          {isMention ? (
            <span className="rounded-full border border-blue-500/30 bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-800 dark:border-blue-500/35 dark:bg-blue-500/20 dark:text-blue-300">
              Mention
            </span>
          ) : null}
        </div>

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
                data-test={`notification-${notification._id}-mark-read-button`}
                className="h-7 gap-1 px-2 text-xs"
                disabled={markReadPending}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleMarkRead();
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
                data-test={`notification-${notification._id}-open-task-button`}
                className="h-7 gap-1 px-2 text-xs"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleMarkRead();
                  onOpenTicket({ ticketId: String(ticketId), commentId: String(commentId || '') });
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
