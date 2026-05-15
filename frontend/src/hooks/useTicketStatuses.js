import { useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTaskStatusesQuery } from '@/queries/taskStatuses';
import { buildTicketStatusHelpers } from '@/helpers/ticketStatus';

export const useTicketStatuses = (workspaceIdProp) => {
  const { user } = useAuth();
  const workspaceId = workspaceIdProp || user?.workspaceId;

  const { data: statuses = [], isLoading, isError, error, refetch } = useTaskStatusesQuery(
    workspaceId
  );

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
