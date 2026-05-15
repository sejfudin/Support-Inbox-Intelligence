import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  getTicketDescriptionImages,
  uploadTicketDescriptionImages,
  deleteTicketDescriptionImage,
} from '@/api/tickets';
import { invalidateAnalyticsQueries } from '@/lib/analyticsQueryCache';

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
      invalidateAnalyticsQueries(queryClient);
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
      invalidateAnalyticsQueries(queryClient);
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
      queryClient.invalidateQueries({ queryKey: ['ticket-history', ticketId] });
      invalidateAnalyticsQueries(queryClient);
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

// supabase

export const useTicketDescriptionImages = (ticketId) => {
  return useQuery({
    queryKey: ['ticket-description-images', ticketId],
    queryFn: () => getTicketDescriptionImages(ticketId),
    enabled: !!ticketId,
  });
};

export const useUploadTicketDescriptionImages = (ticketId) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (files) => uploadTicketDescriptionImages(ticketId, files),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-description-images', ticketId] });
    },
  });
};

export const useDeleteTicketDescriptionImage = (ticketId) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (imageId) => deleteTicketDescriptionImage(ticketId, imageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-description-images', ticketId] });
    },
  });
};
