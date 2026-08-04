import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { registerUser, loginUser, getMe, logoutUser, updateUser } from '@/api/auth';
import { useNavigate } from 'react-router-dom';
import { clearSessionQueries } from '@/lib/sessionQueryCache';

export const authKeys = {
  all: ['auth'],
  me: () => [...authKeys.all, 'me'],
};

export const useRegisterUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userData) => registerUser(userData),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },

    onError: (error) => {
      console.error('Registration error:', error.response?.data?.message || error.message);
    },
  });
};

export const useLoginUser = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: loginUser,

    onSuccess: (data) => {
      clearSessionQueries(queryClient);
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      queryClient.invalidateQueries({ queryKey: authKeys.me() });
      navigate('/');
    },

    onError: (error) => {
      console.error('Login error:', error.response?.data?.message || error.message);
    },
  });
};

export const useGetMe = () => {
  return useQuery({
    queryKey: authKeys.me(),
    queryFn: () => getMe(),
    staleTime: 5 * 60 * 1000,
    enabled: !!localStorage.getItem('accessToken'),
    retry: false,
  });
};

export const useLogoutUser = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const clearAuth = () => {
    clearSessionQueries(queryClient);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    navigate('/login');
  };

  return useMutation({
    mutationFn: () => logoutUser(localStorage.getItem('refreshToken')),
    onSuccess: clearAuth,
    onError: (error) => {
      clearAuth();
    },
  });
};

export const useUpdateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => updateUser(id, data),

    onSuccess: (updatedUser, variables) => {
      queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === 'users',
      });
      queryClient.setQueryData(['user', variables.id], updatedUser);

      const currentMe = queryClient.getQueryData(authKeys.me());
      const currentId = currentMe?.id || currentMe?._id;

      // Refetch rather than seeding the cache from the PATCH response: /auth/me
      // reports the *verified* workspace (a stale User.workspaceId pointer reads
      // as null there), while this payload carries the raw pointer and would
      // re-grant workspace nav that the gate is supposed to withhold.
      if (currentId === variables.id) {
        queryClient.invalidateQueries({ queryKey: authKeys.me() });
      }
    },
    onError: (error) => {
      console.error('Update error:', error.response?.data?.message || error.message);
    },
  });
};
