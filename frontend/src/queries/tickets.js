import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import {
  getAllTickets,
  getTicket,
  addMessage,
  createTicket,
  archiveTicket,
  updateTicket,
  getMyTickets,
  suggestTicketMetadata,
  generateTicketDescription,
} from '@/api/tickets';

const invalidateWorkspaceAnalytics = (queryClient) => {
  queryClient.invalidateQueries({
    predicate: (query) =>
      Array.isArray(query.queryKey) &&
      query.queryKey[0] === 'workspaces' &&
      query.queryKey.includes('analytics'),
  });
};

const invalidateUserAnalytics = (queryClient) => {
  queryClient.invalidateQueries({
    predicate: (query) =>
      Array.isArray(query.queryKey) &&
      query.queryKey[0] === 'workspaces' &&
      query.queryKey.includes('user-analytics'),
  });
};

export const useTickets = (params, options = {}) => {
  return useQuery({
    queryKey: ['tickets', params],
    queryFn: () => getAllTickets(params),
    placeholderData: (previousData) => previousData,
    ...options,
  });
};

export const useTicket = (id) => {
  return useQuery({
    queryKey: ['ticket', id],
    queryFn: () => getTicket(id),
    enabled: !!id,
  });
};

export const useAddMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addMessage,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(['ticket', variables.ticketId]);
    },
  });
};
export const useCreateTicket = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTicket,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      invalidateWorkspaceAnalytics(queryClient);
      invalidateUserAnalytics(queryClient);
    },
  });
};

export const useUpdateTicket = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (vars) => updateTicket(vars.ticketId, vars.updates),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ticket', variables.ticketId] });
      queryClient.invalidateQueries({ queryKey: ['ticket-history', variables.ticketId] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      invalidateWorkspaceAnalytics(queryClient);
      invalidateUserAnalytics(queryClient);
    },
  });
};

export const useArchiveTicket = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: archiveTicket,
    onSuccess: (_, ticketId) => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
      invalidateWorkspaceAnalytics(queryClient);
      invalidateUserAnalytics(queryClient);
    },
  });
};

export const useMyTickets = (params, options = {}) => {
  return useQuery({
    queryKey: ['tickets', 'workspace', params],
    queryFn: () => getMyTickets(params),
    placeholderData: (previousData) => previousData,
    ...options,
  });
};

export const useSuggestTicketMetadata = () => {
  return useMutation({
    mutationFn: suggestTicketMetadata,
  });
};

export const useGenerateTicketDescription = () => {
  return useMutation({
    mutationFn: generateTicketDescription,
  });
};

export const useTicketsInfinite = (params, options = {}) => {
  return useInfiniteQuery({
    queryKey: [
      'tickets',
      'infinite',
      params.workspaceId,
      params.status,
      params.search,
      JSON.stringify(params.queryFilters),
    ],
    queryFn: ({ pageParam = 1 }) => getAllTickets({ ...params, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { page, pages } = lastPage.pagination;
      return page < pages ? page + 1 : undefined;
    },
    placeholderData: (previousData) => previousData,
    ...options,
  });
};

export const useMyTicketsInfinite = (params, options = {}) => {
  return useInfiniteQuery({
    queryKey: [
      'tickets',
      'my-infinite',
      params.status,
      params.search,
      JSON.stringify(params.queryFilters),
    ],
    queryFn: ({ pageParam = 1 }) => getMyTickets({ ...params, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { page, pages } = lastPage.pagination;
      return page < pages ? page + 1 : undefined;
    },
    placeholderData: (previousData) => previousData,
    ...options,
  });
};
