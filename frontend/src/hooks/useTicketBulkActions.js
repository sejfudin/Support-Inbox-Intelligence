import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { useBulkArchiveTickets, useBulkTicketStatus } from '@/queries/tickets';

/**
 * Moving or archiving a set of tickets in one request, with the toasts and the
 * archive confirmation that go with it.
 *
 * Both surfaces that can select tickets — the board's columns and the ticket
 * list — run through this, so "what a batch does" is decided once. The selection
 * itself is not here: a board column selects within one status and the list
 * selects within one page, and neither is the other's business.
 *
 * `onDone` is the caller's "clear the selection", and it is called **only on
 * success**: a failed batch keeps the selection so the action can be retried
 * without picking the tickets again.
 */
export function useTicketBulkActions({ workspaceId }) {
  const { mutate: bulkMoveTickets, isPending: isMoving } = useBulkTicketStatus();
  const { mutate: bulkArchiveTickets, isPending: isArchiving } = useBulkArchiveTickets();
  const [pendingArchive, setPendingArchive] = useState(null);

  const moveTickets = useCallback(
    (ticketIds, statusId, onDone) => {
      if (!ticketIds?.length) return;
      bulkMoveTickets(
        { ticketIds, statusId, workspaceId },
        {
          onSuccess: (response) => {
            const moved = response?.data?.length ?? ticketIds.length;
            toast.success(moved === 1 ? '1 ticket moved.' : `${moved} tickets moved.`);
            onDone?.();
          },
          onError: (error) => {
            toast.error(
              error?.response?.data?.message || 'Could not move the selected tickets. Try again.'
            );
          },
        }
      );
    },
    [bulkMoveTickets, workspaceId]
  );

  // Archiving takes tickets off the board in one gesture, so it asks first — a
  // move does not, because a wrong move is one more move back.
  const requestArchive = useCallback((ticketIds, onDone) => {
    if (!ticketIds?.length) return;
    setPendingArchive({ ticketIds, onDone });
  }, []);

  const confirmArchive = useCallback(() => {
    if (!pendingArchive) return;
    const { ticketIds, onDone } = pendingArchive;
    bulkArchiveTickets(
      { ticketIds, workspaceId },
      {
        onSuccess: (response) => {
          const archived = response?.data?.length ?? ticketIds.length;
          toast.success(archived === 1 ? '1 ticket archived.' : `${archived} tickets archived.`);
          setPendingArchive(null);
          onDone?.();
        },
        onError: (error) => {
          toast.error(
            error?.response?.data?.message || 'Could not archive the selected tickets. Try again.'
          );
        },
      }
    );
  }, [bulkArchiveTickets, pendingArchive, workspaceId]);

  // Spread straight into `Modals/ConfirmModal` — the wording of the confirm is
  // part of what a batch archive means, so it lives with the action rather than
  // being written out again on every screen that offers it.
  const archiveConfirmProps = useMemo(() => {
    const count = pendingArchive?.ticketIds.length ?? 0;
    return {
      isOpen: Boolean(pendingArchive),
      onClose: () => setPendingArchive(null),
      onConfirm: confirmArchive,
      isLoading: isArchiving,
      title: 'Archive selected tickets',
      description:
        count === 1
          ? 'Archive this ticket? It leaves the board and can be restored from the archive.'
          : `Archive these ${count} tickets? They leave the board and can be restored from the archive.`,
      confirmLabel: 'Archive',
      loadingLabel: 'Archiving...',
    };
  }, [confirmArchive, isArchiving, pendingArchive]);

  return {
    moveTickets,
    requestArchive,
    archiveConfirmProps,
    isPending: isMoving || isArchiving,
  };
}
