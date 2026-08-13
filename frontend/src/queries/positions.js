import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createPosition, fetchPositions, updatePosition } from '@/api/positions';

export const POSITIONS_QUERY_KEY = ['positions'];

export const usePositions = ({ includeInactive = false } = {}) =>
  useQuery({
    queryKey: [...POSITIONS_QUERY_KEY, includeInactive ? 'all' : 'active'],
    queryFn: () => fetchPositions({ includeInactive }),
    staleTime: 10 * 60 * 1000,
  });

export const useCreatePosition = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createPosition,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: POSITIONS_QUERY_KEY });
    },
  });
};

export const useUpdatePosition = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => updatePosition(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: POSITIONS_QUERY_KEY });
    },
  });
};
