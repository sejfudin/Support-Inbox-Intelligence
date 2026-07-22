/**
 * Attendance API layer. Talks to the real backend (server/routes/attendance.js).
 *
 * Server enforces the rules the client only hints at: check-in is open 07:00–11:00
 * office time on weekdays, and a cancelled day is locked (no re-check-in). The
 * office-network IP allowlist is a later, optional server-side guard.
 */

import apiClient from '@/api/axios';

/**
 * GET /api/attendance/me
 * → { records: [{ date, checkedInAt }], cancelledDates, presentDays, workingDays, attendanceRate }
 */
export const fetchMyAttendance = async () => {
  const { data } = await apiClient.get('/attendance/me');
  return data.data.attendance;
};

/**
 * POST /api/attendance/me/check-in
 * Records today's check-in for the signed-in intern. Idempotent per day.
 * → updated attendance summary (same shape as fetchMyAttendance)
 */
export const checkInToday = async () => {
  const { data } = await apiClient.post('/attendance/me/check-in');
  return data.data.attendance;
};

/**
 * DELETE /api/attendance/me/check-in
 * Cancels today's check-in. One-way: the day is locked as absent and the intern
 * cannot check in again for the rest of the day.
 * → updated attendance summary (same shape as fetchMyAttendance)
 */
export const cancelTodayCheckIn = async () => {
  const { data } = await apiClient.delete('/attendance/me/check-in');
  return data.data.attendance;
};

/**
 * GET /api/attendance  (admin — read-only roster for one month)
 * → { month, roster: [{ intern, records, cancelledDates, presentDays, workingDays, attendanceRate, lastCheckIn }] }
 * Admin-only. Supports optional { month, search, hub } filtering server-side.
 */
export const fetchAttendanceRoster = async (params = {}) => {
  const { data } = await apiClient.get('/attendance', { params });
  return data.data;
};

/**
 * GET /api/attendance/:internProfileId?month=YYYY-MM  (admin)
 * One intern's full attendance history for the calendar modal; `month` selects
 * the stat block (defaults server-side to the current month).
 * → { intern: { id, fullname, email, hub }, records, cancelledDates, month }
 */
export const fetchInternAttendance = async (internProfileId, month) => {
  const { data } = await apiClient.get(`/attendance/${internProfileId}`, {
    params: month ? { month } : undefined,
  });
  return data.data.attendance;
};
