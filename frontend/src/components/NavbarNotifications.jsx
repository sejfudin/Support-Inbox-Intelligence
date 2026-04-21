import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Bell, Check, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@/queries/notifications";

const isMongoId = (value) =>
  typeof value === "string" && /^[a-f\d]{24}$/i.test(value);

export default function NavbarNotifications() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data, isLoading, isError } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const items = data?.data ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const goToTicket = useCallback(
    (ticketId) => {
      if (!isMongoId(ticketId)) return;
      setOpen(false);
      navigate(`/tickets?ticket=${ticketId}`);
    },
    [navigate],
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
          aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
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
                "Mark all read"
              )}
            </Button>
          ) : null}
        </div>

        <ScrollArea className="max-h-80">
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
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              No notifications yet.
            </p>
          ) : (
            <ul className="divide-y">
              {items.map((n) => {
                const ticketId =
                  typeof n.ticket === "string" ? n.ticket : n.ticket?._id || n.ticket;
                const created = n.createdAt ? new Date(n.createdAt) : null;
                const timeLabel =
                  created && !Number.isNaN(created.getTime())
                    ? formatDistanceToNow(created, { addSuffix: true })
                    : "";

                return (
                  <li
                    key={n._id}
                    className={cn(
                      "px-3 py-2.5 transition-colors",
                      !n.read ? "bg-primary/5" : "bg-transparent",
                    )}
                  >
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-medium leading-snug text-foreground">
                        {n.title}
                      </p>
                      {n.body ? (
                        <p className="line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                      ) : null}
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {timeLabel ? (
                          <span className="text-[10px] text-muted-foreground">{timeLabel}</span>
                        ) : null}
                        <div className="ml-auto flex flex-wrap items-center gap-1">
                          {!n.read ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 gap-1 px-2 text-xs"
                              disabled={markRead.isPending}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                markRead.mutate(n._id);
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
                                goToTicket(String(ticketId));
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
              })}
            </ul>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
