import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { fetchAdminDashboard } from '@/api/adminDashboard';

// Invalidated by the Socket.IO workspace and workspace-tickets scopes — ticket and
// status changes move the workload numbers on this dashboard. The scopes name this
// key explicitly (`lib/invalidationScopes.js`); nothing here prefix-matches on its
// own, so renaming `all` means updating that file too.
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
