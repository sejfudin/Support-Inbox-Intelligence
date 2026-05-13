import { useQuery } from '@tanstack/react-query';
import { getUser, getUsers } from '@/api/users';

export const useUsers = (filters = { page: 1, limit: 10, search: '', pagination: true }) => {
  return useQuery({
    queryKey: ['users', filters],
    queryFn: () => getUsers(filters),
    keepPreviousData: true,
  });
};

export const useUser = (id) => {
  return useQuery({
    queryKey: ['users', id],
    queryFn: () => getUser(id),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  });
};
