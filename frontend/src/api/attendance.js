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
  return data.attendance;
};

/**
 * POST /api/attendance/me/check-in
 * Records today's check-in for the signed-in intern. Idempotent per day.
 * → updated attendance summary (same shape as fetchMyAttendance)
 */
export const checkInToday = async () => {
  const { data } = await apiClient.post('/attendance/me/check-in');
  return data.attendance;
};

/**
 * DELETE /api/attendance/me/check-in
 * Cancels today's check-in. One-way: the day is locked as absent and the intern
 * cannot check in again for the rest of the day.
 * → updated attendance summary (same shape as fetchMyAttendance)
 */
export const cancelTodayCheckIn = async () => {
  const { data } = await apiClient.delete('/attendance/me/check-in');
  return data.attendance;
};

/**
 * GET /api/attendance  (mentor/admin — read-only roster)
 * → { roster: [{ intern, records, cancelledDates, presentDays, workingDays, attendanceRate, lastCheckIn }] }
 * Mentors are scoped to their assigned interns; admins see everyone. Supports
 * optional { search, hub } filtering server-side.
 */
export const fetchAttendanceRoster = async (params = {}) => {
  const { data } = await apiClient.get('/attendance', { params });
  return data;
};
