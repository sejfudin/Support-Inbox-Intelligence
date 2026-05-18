import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCategories, createCategory, updateCategory, deleteCategory } from '@/api/categories';
import { invalidateWorkspaceScope } from '@/lib/invalidationScopes';

export const categoryKeys = {
  byWorkspace: (workspaceId) => ['categories', workspaceId],
};

export const useCategories = (workspaceId, options = {}) => {
  return useQuery({
    queryKey: categoryKeys.byWorkspace(workspaceId),
    queryFn: () => getCategories(workspaceId),
    enabled: !!workspaceId,
    staleTime: 5 * 60 * 1000,
    ...options,
  });
};

export const useCreateCategory = (workspaceId) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      invalidateWorkspaceScope(queryClient, workspaceId);
    },
  });
};

export const useUpdateCategory = (workspaceId) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => updateCategory(id, data),
    onSuccess: () => {
      invalidateWorkspaceScope(queryClient, workspaceId);
    },
  });
};

export const useDeleteCategory = (workspaceId) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      invalidateWorkspaceScope(queryClient, workspaceId);
    },
  });
};
