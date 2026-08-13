/**
 * Attendance request API layer (server/routes/attendanceRequest.js).
 *
 * One endpoint family covers all four things an intern can ask for — remote work,
 * vacation, a religious holiday, a sick day — because they share a lifecycle: the
 * intern asks for a set of days, an admin decides the request as a unit, and an
 * approval writes one attendance row per day. Nothing here is a check-in, so the
 * 07:00–11:00 window never applies.
 *
 * What differs per type (the per-request ceiling, the yearly allowance, how far
 * back it may reach) is **not** duplicated on the client. The server sends it in
 * `types` on every list response and the panel renders from that, so the rules live
 * in exactly one place: `server/helpers/attendanceRequestRules.js`.
 */

import apiClient from '@/api/axios';

/**
 * GET /api/attendance-requests/me  (intern)
 * → { requests: [{ id, type, dates, status, reason, decisionNote, decidedAt, decidedBy }],
 *     types: [{ type, label, maxDaysPerRequest, earliestDate, latestDate,
 *               budget: { budget, used, remaining } | null }] }
 */
export const fetchMyAttendanceRequests = async () => {
  const { data } = await apiClient.get('/attendance-requests/me');
  return data.data.attendanceRequests;
};

/**
 * POST /api/attendance-requests/me  (intern) — ask for days of one type.
 * @param {{ type: string, dates: string[], reason?: string }} payload - dates are 'yyyy-MM-dd'
 * → the updated list, same shape as fetchMyAttendanceRequests
 */
export const createAttendanceRequest = async (payload) => {
  const { data } = await apiClient.post('/attendance-requests/me', payload);
  return data.data.attendanceRequests;
};

/**
 * DELETE /api/attendance-requests/me/:id  (intern) — withdraw a pending request.
 * → the updated list
 */
export const cancelAttendanceRequest = async (id) => {
  const { data } = await apiClient.delete(`/attendance-requests/me/${id}`);
  return data.data.attendanceRequests;
};

/**
 * GET /api/attendance-requests?status=pending|all&type=remote|…  (admin)
 * → { requests: [{ id, type, dates, …, intern: { id, fullname, email, hub } }],
 *     pendingCount, pendingByType }
 *
 * `pendingCount` is deliberately unfiltered, so the nav dot and the tab badge keep
 * meaning "anything waiting" even while a type filter is applied.
 */
export const fetchAttendanceRequests = async (params = {}) => {
  const { data } = await apiClient.get('/attendance-requests', { params });
  return data.data.attendanceRequests;
};

/**
 * PATCH /api/attendance-requests/:id  (admin) — approve or reject a pending request.
 * Approving writes the intern's attendance rows for every day in it.
 * @param {{ id: string, decision: 'approved'|'rejected', note?: string }} payload
 */
export const decideAttendanceRequest = async ({ id, decision, note }) => {
  const { data } = await apiClient.patch(`/attendance-requests/${id}`, { decision, note });
  return data.data.attendanceRequests;
};

/**
 * DELETE /api/attendance-requests/:id  (admin) — undo an approval, removing the
 * attendance rows it created.
 */
export const revokeAttendanceRequest = async ({ id, note }) => {
  const { data } = await apiClient.delete(`/attendance-requests/${id}`, { data: { note } });
  return data.data.attendanceRequests;
};
