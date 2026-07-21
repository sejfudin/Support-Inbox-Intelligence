/**
 * Attendance API layer.
 *
 * ⚠️ FRONTEND-ONLY SHOWCASE: this currently returns mock data (see
 * `@/mocks/attendance`). The functions are shaped exactly like the rest of the
 * `api/*` layer so that switching to the real backend is a drop-in change:
 * uncomment the `apiClient` calls, delete the mock branch, and remove the mock
 * import. Each function's docstring documents its endpoint + response shape.
 *
 * Backend rules to enforce server-side (not the client): check-in is only open
 * 07:00–11:00 office time and only from the office network IP allowlist; a
 * cancelled day is locked as absent and cannot be re-checked-in. After the real
 * endpoints exist, delete `@/mocks/attendance` and this mock branch.
 */

// import apiClient from '@/api/axios';
import {
  ATTENDANCE_MOCK_ENABLED,
  getMyMockAttendance,
  checkInMock,
  cancelCheckInMock,
  getMockRoster,
} from '@/mocks/attendance';

// Simulate network latency so loading states are visible in the demo.
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * GET /api/attendance/me
 * → { records: [{ date, checkedInAt }], presentDays, workingDays, attendanceRate }
 */
export const fetchMyAttendance = async () => {
  if (ATTENDANCE_MOCK_ENABLED) {
    await delay(300);
    return getMyMockAttendance();
  }
  // const { data } = await apiClient.get('/attendance/me');
  // return data.attendance;
};

/**
 * POST /api/attendance/me/check-in
 * Records today's check-in for the signed-in intern. Idempotent per day.
 * → updated attendance summary (same shape as fetchMyAttendance)
 */
export const checkInToday = async () => {
  if (ATTENDANCE_MOCK_ENABLED) {
    await delay(400);
    return checkInMock();
  }
  // const { data } = await apiClient.post('/attendance/me/check-in');
  // return data.attendance;
};

/**
 * DELETE /api/attendance/me/check-in
 * Cancels today's check-in. This is a one-way action: the day is locked as
 * absent and the intern cannot check in again for the rest of the day.
 * → updated attendance summary (same shape as fetchMyAttendance)
 */
export const cancelTodayCheckIn = async () => {
  if (ATTENDANCE_MOCK_ENABLED) {
    await delay(400);
    return cancelCheckInMock();
  }
  // const { data } = await apiClient.delete('/attendance/me/check-in');
  // return data.attendance;
};

/**
 * GET /api/attendance  (mentor/admin — read-only roster)
 * → { roster: [{ intern, records, presentDays, workingDays, attendanceRate, lastCheckIn }] }
 * Supports optional { search, hub } filtering server-side; here we filter client-side.
 */
export const fetchAttendanceRoster = async (params = {}) => {
  if (ATTENDANCE_MOCK_ENABLED) {
    await delay(350);
    let roster = getMockRoster();
    const { search, hub } = params;
    if (search) {
      const q = search.toLowerCase();
      roster = roster.filter(
        (r) =>
          r.intern.fullname.toLowerCase().includes(q) ||
          r.intern.email.toLowerCase().includes(q)
      );
    }
    if (hub) roster = roster.filter((r) => r.intern.hub === hub);
    return { roster };
  }
  // const { data } = await apiClient.get('/attendance', { params });
  // return data;
};
