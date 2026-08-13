import apiClient from '@/api/axios';

/**
 * GET /api/dashboard/me/progress — everything the programme records about the
 * signed-in intern, read-only.
 *
 * Takes no parameters, like the intern board's own endpoint: it is intern-only and
 * resolves the subject from the access token, so there is no intern id to pass and
 * no way to ask for somebody else's. Attendance is deliberately not part of it —
 * `/my-attendance` owns that, and `api/attendance.js` is its data path.
 *
 * → { programme, evaluations, readiness, recommendations }
 */
export const fetchInternProgress = async () => {
  const { data } = await apiClient.get('/dashboard/me/progress');
  return data.data;
};
