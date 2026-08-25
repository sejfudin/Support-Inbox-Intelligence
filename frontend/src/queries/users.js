import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { getUser, getUsers, sendMentorNote } from '@/api/users';

export const useUsers = (filters = { page: 1, limit: 10, search: '', pagination: true }) => {
  return useQuery({
    queryKey: ['users', filters],
    queryFn: () => getUsers(filters),
    // `keepPreviousData: true` was the v4 spelling and this app is on v5, where it is not an
    // option at all — it sat here doing nothing, so every page click and every keystroke of the
    // admin user search dropped the table back to `isPending` and redrew the whole skeleton.
    placeholderData: keepPreviousData,
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

// Mentors only — the picker for "send a note to a mentor". Deliberately not
// `useMentorCandidates` above: that one is admin-or-mentor for specialization
// assignment, a different question ("who can mentor this intern") from this
// one ("which mentor, specifically").
export const useMentorNoteCandidates = (options = {}) =>
  useQuery({
    queryKey: ['mentor-note-candidates'],
    queryFn: () => getUsers({ pagination: false, roles: 'mentor', status: 'active' }),
    staleTime: 5 * 60 * 1000,
    ...options,
  });

export const useSendMentorNote = () =>
  useMutation({
    mutationFn: ({ userId, body }) => sendMentorNote(userId, body),
  });
