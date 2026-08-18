import { Inbox } from 'lucide-react';

import EmptyState from '@/components/EmptyState';

/**
 * Loading / error / empty for every ticket list. The empty branch is the mockup's
 * Backlog treatment via `EmptyState` — pass `emptyTitle` + `emptyDescription` (and
 * optionally one `emptyAction`); `emptyMessage` stays as the one-line fallback for
 * callers that have not been given real copy yet.
 */
export default function TicketsState({
  isLoading,
  isError,
  isEmpty,
  emptyMessage = 'No results.',
  emptyTitle,
  emptyDescription,
  emptyIcon = Inbox,
  emptyAction = null,
  loadingSlot = null,
  children,
}) {
  if (isLoading) {
    if (loadingSlot) return loadingSlot;
    return (
      <div className="flex h-64 items-center justify-center text-[12.5px] font-medium text-muted-foreground">
        Loading tickets…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-64 items-center justify-center text-[12.5px] text-[hsl(var(--tone-danger-fg))]">
        Something went wrong.
      </div>
    );
  }

  if (isEmpty) {
    return (
      <EmptyState
        icon={emptyIcon}
        title={emptyTitle || emptyMessage}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  return children;
}
