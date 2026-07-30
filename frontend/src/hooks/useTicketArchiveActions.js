import { useState } from 'react';
import { toast } from 'sonner';
import { useArchiveTicket, useUnarchiveTicket } from '@/queries/tickets';

export const useTicketArchiveActions = (ticketId, onClose) => {
  const { mutate: archiveTicket, isPending: isArchiving } = useArchiveTicket();
  const { mutate: unarchiveTicket, isPending: isUnarchiving } = useUnarchiveTicket();

  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [isActionPending, setIsActionPending] = useState(false);
  const [actionError, setActionError] = useState(null);

  const handleArchiveToggle = () => {
    setIsActionModalOpen(true);
  };

  const handleRestore = () => {
    if (!ticketId) return;
    unarchiveTicket(ticketId, {
      onSuccess: () => {
        onClose();
        toast.success('Ticket restored', {
          description: 'The ticket is back in the active views under its current status.',
          action: {
            label: 'Undo',
            onClick: () => archiveTicket(ticketId),
          },
        });
      },
      onError: (error) => {
        toast.error('Failed to restore ticket', {
          description: error?.response?.data?.message || 'Please try again.',
        });
      },
    });
  };

  const handleConfirmAction = () => {
    setIsActionPending(true);
    setActionError(null);

    archiveTicket(ticketId, {
      onSuccess: () => {
        setIsActionModalOpen(false);
        setIsActionPending(false);
        onClose();
        toast.success('Ticket archived', {
          description: 'The ticket has been moved to archive and is now read-only.',
        });
      },
      onError: (error) => {
        setIsActionPending(false);
        const message =
          error?.response?.data?.message || 'Failed to archive ticket. Please try again.';
        setActionError(message);
        toast.error('Action failed', {
          description: message,
        });
      },
    });
  };

  return {
    isArchiving,
    isUnarchiving,
    isActionModalOpen,
    setIsActionModalOpen,
    isActionPending,
    actionError,
    handleArchiveToggle,
    handleRestore,
    handleConfirmAction,
  };
};
