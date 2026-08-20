import { formatDistanceToNow } from 'date-fns';
import { Check, ExternalLink, PartyPopper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  getTicketIdFromNotification,
  getCommentIdFromNotification,
  getNotificationLink,
  isMongoId,
} from '@/helpers/notificationUtils';

export function NotificationRow({
  notification,
  markReadPending,
  onMarkRead,
  onOpenTicket,
  onOpenLink,
}) {
  const ticketId = getTicketIdFromNotification(notification);
  const commentId = getCommentIdFromNotification(notification);
  const link = getNotificationLink(notification);
  const created = notification.createdAt ? new Date(notification.createdAt) : null;
  const timeLabel =
    created && !Number.isNaN(created.getTime())
      ? formatDistanceToNow(created, { addSuffix: true })
      : '';

  const isMention = notification.type === 'ticket_mention';
  const isPlacement = notification.type === 'intern_placed';
  const canMarkRead = !notification.read && !markReadPending && notification._id;
  const hasTicketTarget = isMongoId(String(ticketId));
  const hasDestination = hasTicketTarget || Boolean(link);
  const isClickable = canMarkRead || hasDestination;

  const handleMarkRead = () => {
    if (!canMarkRead) return;
    onMarkRead(notification._id);
  };

  // Clicking anywhere on the row opens the notification's destination (same
  // as the explicit button below) and marks it read as a side effect — not
  // just mark-read, which made the row feel unresponsive when there was
  // somewhere to go. Buttons stop propagation so this doesn't double-fire.
  const handleRowActivate = () => {
    handleMarkRead();
    if (hasTicketTarget) {
      onOpenTicket({ ticketId: String(ticketId), commentId: String(commentId || '') });
    } else if (link) {
      onOpenLink(link);
    }
  };

  return (
    <li
      data-test={`notification-row-${notification._id}`}
      className={cn(
        'px-3 py-2.5 transition-colors',
        !notification.read ? 'cursor-pointer bg-primary/5 hover:bg-primary/10' : 'bg-transparent',
        hasDestination && 'cursor-pointer hover:bg-muted/40'
      )}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={handleRowActivate}
      onKeyDown={(e) => {
        if (!isClickable || (e.key !== 'Enter' && e.key !== ' ')) return;
        e.preventDefault();
        handleRowActivate();
      }}
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium leading-snug text-foreground">{notification.title}</p>
          {isMention ? (
            <span className="rounded-full border border-[hsl(var(--tone-info)/0.3)] bg-[hsl(var(--tone-info)/0.15)] px-2 py-0.5 text-[10px] font-semibold text-[hsl(var(--tone-info-fg))] dark:border-[hsl(var(--tone-info)/0.35)] dark:bg-[hsl(var(--tone-info)/0.2)] dark:text-[hsl(var(--tone-info-fg))]">
              Mention
            </span>
          ) : null}
          {isPlacement ? (
            <span className="flex items-center gap-1 rounded-full border border-[hsl(var(--tone-success)/0.3)] bg-[hsl(var(--tone-success)/0.15)] px-2 py-0.5 text-[10px] font-semibold text-[hsl(var(--tone-success-fg))] dark:border-[hsl(var(--tone-success)/0.35)] dark:bg-[hsl(var(--tone-success)/0.15)] dark:text-[hsl(var(--tone-success-fg))]">
              <PartyPopper className="h-2.5 w-2.5" />
              Placed
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
            ) : link ? (
              <Button
                type="button"
                variant="default"
                size="sm"
                data-test={`notification-${notification._id}-open-link-button`}
                className="h-7 gap-1 px-2 text-xs"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleMarkRead();
                  onOpenLink(link);
                }}
              >
                <ExternalLink className="h-3 w-3" />
                View
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}
