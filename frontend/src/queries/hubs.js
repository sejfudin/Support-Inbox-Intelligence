import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createHub, fetchHubs, updateHub } from '@/api/hubs';

export const HUBS_QUERY_KEY = ['hubs'];

export const useHubs = ({ includeInactive = false } = {}) =>
  useQuery({
    queryKey: [...HUBS_QUERY_KEY, includeInactive ? 'all' : 'active'],
    queryFn: () => fetchHubs({ includeInactive }),
    staleTime: 10 * 60 * 1000,
  });

export const useCreateHub = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createHub,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: HUBS_QUERY_KEY });
    },
  });
};

export const useUpdateHub = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => updateHub(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: HUBS_QUERY_KEY });
    },
  });
};
