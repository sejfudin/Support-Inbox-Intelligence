import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createProject, fetchProjects, updateProject } from '@/api/projects';

export const PROJECTS_QUERY_KEY = ['projects'];

export const useProjects = ({ includeAll = false, status } = {}) =>
  useQuery({
    queryKey: [...PROJECTS_QUERY_KEY, includeAll ? 'all' : 'active', status || null],
    queryFn: () => fetchProjects({ includeAll, status }),
    staleTime: 10 * 60 * 1000,
  });

export const useCreateProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY });
    },
  });
};

export const useUpdateProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => updateProject(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY });
    },
  });
};
