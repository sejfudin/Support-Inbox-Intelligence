import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { fetchAdminDashboard } from '@/api/adminDashboard';

// Keyed under 'workspace:' so the Socket.IO workspace-scope invalidation reaches
// it — ticket and status changes move the workload numbers on this dashboard.
export const adminDashboardKeys = {
  all: ['workspace-admin-dashboard'],
  detail: (workspaceId) => [...adminDashboardKeys.all, workspaceId],
};

export const useAdminDashboard = (workspaceId, options = {}) =>
  useQuery({
    queryKey: adminDashboardKeys.detail(workspaceId),
    queryFn: () => fetchAdminDashboard(workspaceId),
    enabled: Boolean(workspaceId),
    // Switching workspace keeps the previous board on screen instead of
    // collapsing to skeletons for a frame.
    placeholderData: keepPreviousData,
    ...options,
  });
