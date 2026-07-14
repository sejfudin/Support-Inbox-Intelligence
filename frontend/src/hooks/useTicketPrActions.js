import { useState } from 'react';
import { toast } from 'sonner';
import { useRefreshPR, useUnlinkPR } from '@/queries/github';

export const useTicketPrActions = (ticketId, ticket) => {
  const { mutate: refreshPR, isPending: isRefreshingPR } = useRefreshPR();
  const { mutate: unlinkPR, isPending: isUnlinkingPR } = useUnlinkPR();

  const [isUnlinkModalOpen, setIsUnlinkModalOpen] = useState(false);
  const [unlinkError, setUnlinkError] = useState(null);

  const handleRefreshPR = () => {
    if (!ticket?.linkedPullRequest) return;
    refreshPR(
      { ticketId, workspaceId: ticket?.workspace },
      {
        onSuccess: () => {
          toast.success('PR status refreshed');
        },
        onError: (error) => {
          toast.error('Failed to refresh PR', {
            description: error?.response?.data?.message || 'Please try again',
          });
        },
      }
    );
  };

  const handleUnlinkPR = () => {
    setIsUnlinkModalOpen(true);
    setUnlinkError(null);
  };

  const handleConfirmUnlink = () => {
    setUnlinkError(null);
    unlinkPR(ticketId, {
      onSuccess: () => {
        setIsUnlinkModalOpen(false);
        toast.success('PR unlinked successfully');
      },
      onError: (error) => {
        setUnlinkError(error?.response?.data?.message || 'Failed to unlink PR');
      },
    });
  };

  return {
    isRefreshingPR,
    isUnlinkingPR,
    isUnlinkModalOpen,
    setIsUnlinkModalOpen,
    unlinkError,
    handleRefreshPR,
    handleUnlinkPR,
    handleConfirmUnlink,
  };
};
