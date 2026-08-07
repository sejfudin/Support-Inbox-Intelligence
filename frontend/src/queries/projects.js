import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createProject,
  fetchProject,
  fetchProjectOverview,
  fetchProjects,
  fetchProjectsOverview,
  updateProject,
} from '@/api/projects';

export const PROJECTS_QUERY_KEY = ['projects'];
export const projectDetailKey = (id) => ['project', id];
export const projectOverviewKey = (id) => ['project', id, 'overview'];
export const PROJECTS_OVERVIEW_QUERY_KEY = ['projects', 'overview'];

export const useProjects = ({ includeAll = false, status } = {}) =>
  useQuery({
    queryKey: [...PROJECTS_QUERY_KEY, includeAll ? 'all' : 'active', status || null],
    queryFn: () => fetchProjects({ includeAll, status }),
    staleTime: 10 * 60 * 1000,
  });

export const useProject = (id, options = {}) =>
  useQuery({
    queryKey: projectDetailKey(id),
    queryFn: () => fetchProject(id),
    enabled: Boolean(id),
    ...options,
  });

// Leadership-facing: full project list + KPI/chart aggregate in one call.
export const useProjectsOverview = (options = {}) =>
  useQuery({
    queryKey: PROJECTS_OVERVIEW_QUERY_KEY,
    queryFn: fetchProjectsOverview,
    staleTime: 60 * 1000,
    ...options,
  });

// Leadership-facing: one project's placed / in-selection / outcome history.
export const useProjectOverview = (id, options = {}) =>
  useQuery({
    queryKey: projectOverviewKey(id),
    queryFn: () => fetchProjectOverview(id),
    enabled: Boolean(id),
    staleTime: 60 * 1000,
    ...options,
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
