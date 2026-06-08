import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createInternshipType,
  fetchInternshipTypes,
  updateInternshipType,
} from '@/api/internshipTypes';

export const INTERNSHIP_TYPES_QUERY_KEY = ['internship-types'];

export const useInternshipTypes = ({ includeInactive = false } = {}) =>
  useQuery({
    queryKey: [...INTERNSHIP_TYPES_QUERY_KEY, includeInactive ? 'all' : 'active'],
    queryFn: () => fetchInternshipTypes({ includeInactive }),
    staleTime: 10 * 60 * 1000,
  });

export const useCreateInternshipType = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createInternshipType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INTERNSHIP_TYPES_QUERY_KEY });
    },
  });
};

export const useUpdateInternshipType = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => updateInternshipType(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INTERNSHIP_TYPES_QUERY_KEY });
    },
  });
};
