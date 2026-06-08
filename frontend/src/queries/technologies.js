import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createTechnology, fetchTechnologies, updateTechnology } from '@/api/technologies';

export const TECHNOLOGIES_QUERY_KEY = ['technologies'];

export const useTechnologies = ({ includeInactive = false } = {}) =>
  useQuery({
    queryKey: [...TECHNOLOGIES_QUERY_KEY, includeInactive ? 'all' : 'active'],
    queryFn: () => fetchTechnologies({ includeInactive }),
    staleTime: 10 * 60 * 1000,
  });

export const useCreateTechnology = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createTechnology,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TECHNOLOGIES_QUERY_KEY });
    },
  });
};

export const useUpdateTechnology = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => updateTechnology(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TECHNOLOGIES_QUERY_KEY });
    },
  });
};
