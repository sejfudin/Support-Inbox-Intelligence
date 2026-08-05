import apiClient from '@/api/axios';

/**
 * GET /api/dashboard/me — everything the intern board renders except attendance.
 *
 * Takes no parameters by design: the endpoint is intern-only and resolves the
 * subject from the access token, so there is no workspace or intern id to pass
 * (unlike the admin board's `?workspaceId=`). Attendance comes from
 * `api/attendance.js` `fetchMyAttendance` instead — that endpoint already owns
 * the record history the hero derives its streak and week strip from, and the
 * check-in mutations seed and invalidate it.
 *
 * → { date, workspace, workload, tickets, standup, pipeline, evaluations }
 */
export const fetchInternDashboard = async () => {
  const { data } = await apiClient.get('/dashboard/me');
  return data.data;
};

/**
 * POST /api/dashboard/me/standup-summary
 *
 * Condenses the caller's own standup note for today. Also parameterless — the
 * server locates the note from the access token. Idempotent: a note whose cached
 * summary still matches its text comes back without an AI call, so retrying or
 * mounting twice is cheap.
 *
 * → { summary, generatedAt, cached }
 */
export const summarizeMyStandup = async () => {
  const { data } = await apiClient.post('/dashboard/me/standup-summary');
  return data.data;
};
