import { useQuery } from '@tanstack/react-query';
import { fetchRoles } from '@/api/roles';

export const ROLES_QUERY_KEY = ['roles'];

export const useRoles = () =>
  useQuery({
    queryKey: ROLES_QUERY_KEY,
    queryFn: fetchRoles,
    staleTime: 10 * 60 * 1000,
  });
