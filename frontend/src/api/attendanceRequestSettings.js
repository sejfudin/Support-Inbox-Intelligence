/**
 * The admin-set limits on attendance requests
 * (server/routes/attendanceSettings.js). Admin-only in both directions.
 *
 * Interns never call this. The numbers that apply to them arrive already resolved
 * in the `types` payload of their own request list, so the request form has no
 * second source to disagree with.
 */

import apiClient from '@/api/axios';

/**
 * GET /api/attendance-request-settings  (admin)
 * → { bounds: { maxDaysPerRequest: { min, max }, yearlyBudget: { min, max } },
 *     types: [{ type, label, budgeted, maxDaysPerRequest, yearlyBudget,
 *               defaults: { maxDaysPerRequest, yearlyBudget }, isDefault }],
 *     updatedAt, updatedBy }
 *
 * `budgeted` is the field to branch on, not `yearlyBudget === null`: remote and
 * sick are unbudgeted by design, not merely unset, and must not be offered a
 * yearly input.
 */
export const fetchAttendanceRequestSettings = async () => {
  const { data } = await apiClient.get('/attendance-request-settings');
  return data.data.settings;
};

/**
 * PUT /api/attendance-request-settings  (admin)
 * @param {{ limits: { [type]: { maxDaysPerRequest?: number, yearlyBudget?: number } } }} payload
 *
 * A partial merge: types left out keep what they have. Sending `yearlyBudget` for
 * an unbudgeted type is refused rather than ignored.
 * → the updated settings, same shape as the fetch
 */
export const updateAttendanceRequestSettings = async (payload) => {
  const { data } = await apiClient.put('/attendance-request-settings', payload);
  return data.data.settings;
};

/**
 * DELETE /api/attendance-request-settings  (admin) — forget every override and
 * fall back to the shipped defaults.
 * → the updated settings
 */
export const resetAttendanceRequestSettings = async () => {
  const { data } = await apiClient.delete('/attendance-request-settings');
  return data.data.settings;
};
