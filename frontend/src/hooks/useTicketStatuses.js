import { useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTicketStatusesQuery } from '@/queries/ticketStatuses';
import { buildTicketStatusHelpers } from '@/helpers/ticketStatus';

export const useTicketStatuses = (workspaceIdProp) => {
  const { user } = useAuth();
  const workspaceId = workspaceIdProp || user?.workspaceId;

  const { data, isLoading, isError, error, refetch } = useTicketStatusesQuery(workspaceId);

  const statuses = data ?? [];

  const helpers = useMemo(() => buildTicketStatusHelpers(statuses), [statuses]);

  return {
    statuses,
    helpers,
    isLoading,
    isError,
    error,
    refetch,
    workspaceId,
  };
};
