import apiClient from './axios';

/**
 * GET /api/admin/dashboard?workspaceId=  (admin-only)
 *
 * One workspace's dashboard aggregate. The workspace is an explicit query
 * parameter rather than read from the session, but the board passes the caller's
 * active workspace — switching is the sidebar's WorkspaceSwitcher.
 *
 * → {
 *     workspace: { name },
 *     presence: { presentToday, totalInterns, monthAttendanceRate,
 *                 checkInWindow: { label, endHour, state }, absentToday: [...] },
 *     lastPlacement: { intern, project, position, decidedAt, daysAgo, dayOfCycle } | null,
 *     recentPlacements: [ ...same shape ],
 *     recentSpecializations: [{ id, intern: { fullname }, specialization,
 *                              secondaryMentor, assignedAt }],   // newest first, max 3

 *     workloadBuckets: [{ slug, label, color }],   // always four, canonical order
 *     interns: [{ id, fullname, email, position, attendanceRate, presentDays,
 *                 workingDays, workload: [{ slug, label, color, count }] }],
 *   }
 */
export const fetchAdminDashboard = async (workspaceId) => {
  const { data } = await apiClient.get('/admin/dashboard', { params: { workspaceId } });
  return data.data;
};
