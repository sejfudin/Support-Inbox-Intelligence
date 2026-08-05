import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Loader2, CalendarClock, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '@/queries/notifications';
import { NotificationRow } from '@/components/NotificationRow';
import { isMongoId } from '@/helpers/notificationUtils';
import { useAuth } from '@/context/AuthContext';
import { useCheckInReminder } from '@/hooks/useCheckInReminder';
import { cn } from '@/lib/utils';

export default function NavbarNotifications({ size = 'default' }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = useNotifications({
    userId: user?._id || user?.id,
  });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  // Client-side check-in reminder (interns only). Shown until they check in /
  // cancel / the window closes. Adds to the unread indicator like a real one.
  const reminder = useCheckInReminder();

  const items = data?.data ?? [];
  const unreadCount = (data?.unreadCount ?? 0) + (reminder.active ? 1 : 0);

  useEffect(() => {
    if (open) {
      refetch();
    }
  }, [open, refetch]);

  const goToTicket = useCallback(
    (payload) => {
      const ticketId = typeof payload === 'string' ? payload : payload?.ticketId;
      const commentId = typeof payload === 'string' ? null : payload?.commentId;

      if (!isMongoId(ticketId)) return;
      setOpen(false);

      const params = new URLSearchParams({ ticket: ticketId });
      if (isMongoId(commentId)) params.set('comment', commentId);
      params.set('focus', String(Date.now()));

      navigate(`/tickets?${params.toString()}`);
    },
    [navigate]
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          data-test="navbar-notifications-trigger"
          className={cn(
            'relative shrink-0 rounded-full text-foreground hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50',
            size === 'sm' ? 'size-8' : 'h-10 w-10'
          )}
          aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 ? (
            <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-card" />
          ) : null}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[min(100vw-2rem,22rem)] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">Notifications</span>
          {unreadCount > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-test="navbar-notifications-mark-all-read-button"
              className="h-7 text-xs"
              disabled={markAllRead.isPending}
              onClick={(e) => {
                e.preventDefault();
                markAllRead.mutate();
              }}
            >
              {markAllRead.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                'Mark all read'
              )}
            </Button>
          ) : null}
        </div>

        <ScrollArea className="h-80">
          {reminder.active ? (
            <button
              type="button"
              data-test="navbar-notification-check-in-reminder"
              onClick={() => {
                setOpen(false);
                navigate('/my-attendance');
              }}
              className="flex w-full items-start gap-2 border-b bg-amber-500/[0.06] px-3 py-2.5 text-left transition-colors hover:bg-amber-500/10"
            >
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <CalendarClock className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 text-sm font-medium text-foreground">
                  {reminder.title}
                  <ArrowRight className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                </span>
                <span className="line-clamp-2 text-xs text-muted-foreground">{reminder.body}</span>
              </span>
            </button>
          ) : null}

          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : isError ? (
            <p className="px-3 py-6 text-center text-sm text-destructive">
              Could not load notifications.
            </p>
          ) : items.length === 0 ? (
            reminder.active ? null : (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                No notifications yet.
              </p>
            )
          ) : (
            <ul className="divide-y divide-separator">
              {items.map((n) => (
                <NotificationRow
                  key={n._id}
                  notification={n}
                  markReadPending={markRead.isPending}
                  onMarkRead={(id) => markRead.mutate(id)}
                  onOpenTicket={goToTicket}
                />
              ))}
            </ul>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
