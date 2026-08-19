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

export const useMentorCandidates = ({ hubId, hubScoped = false } = {}) =>
  useQuery({
    queryKey: ['mentor-candidates', hubScoped ? hubId : 'all'],
    queryFn: () =>
      getUsers({
        pagination: false,
        roles: 'admin,mentor',
        status: 'active',
        hubId: hubScoped ? hubId : undefined,
      }),
    enabled: !hubScoped || Boolean(hubId),
    staleTime: 5 * 60 * 1000,
  });

// Every active admin — the primary-admin picker on the absence-request settings
// page. Admin-only screen, so (unlike an intern-facing picker) it's safe to reach
// `/admin/users` directly rather than routing through a list response's own
// bundled `admins` field.
export const useAdminCandidates = () =>
  useQuery({
    queryKey: ['admin-candidates'],
    queryFn: () => getUsers({ pagination: false, roles: 'admin', status: 'active' }),
    staleTime: 5 * 60 * 1000,
  });
