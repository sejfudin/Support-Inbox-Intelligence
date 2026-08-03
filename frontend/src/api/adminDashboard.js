import apiClient from './axios';

/**
 * GET /api/admin/dashboard?workspaceId=  (admin-only)
 *
 * One workspace's dashboard aggregate. The workspace is an explicit parameter,
 * not the caller's active workspace — the dashboard has its own picker, so an
 * admin reads any workspace without switching into it.
 *
 * → {
 *     workspace: { id, name, logoPath },
 *     date,                                   // office-local 'YYYY-MM-DD'
 *     presence: { presentToday, totalInterns, monthAttendanceRate, monthKey,
 *                 checkInWindow: { label, endHour, state }, absentToday: [...] },
 *     lastPlacement: { intern, project, position, decidedAt, daysAgo, dayOfCycle } | null,
 *     recentPlacements: [ ...same shape ],
 *     workloadBuckets: [{ slug, label, color }],   // always four, canonical order
 *     interns: [{ id, internProfileId, fullname, email, position, presentToday,
 *                 attendanceRate, workload: [{ slug, label, color, count }], openTickets }],
 *   }
 */
export const fetchAdminDashboard = async (workspaceId) => {
  const { data } = await apiClient.get('/admin/dashboard', { params: { workspaceId } });
  return data.data;
};
