/**
 * The admin-set limits on absence requests
 * (server/routes/absenceSettings.js). Admin-only in both directions.
 *
 * Interns never call this. The numbers that apply to them arrive already resolved
 * in the `types` payload of their own request list, so the request form has no
 * second source to disagree with.
 */

import apiClient from '@/api/axios';

/**
 * GET /api/absence-request-settings  (admin)
 * → { bounds: { maxDaysPerRequest: { min, max }, yearlyBudget: { min, max } },
 *     types: [{ type, label, budgeted, maxDaysPerRequest, yearlyBudget,
 *               defaults: { maxDaysPerRequest, yearlyBudget }, isDefault }],
 *     primaryAdmin: { id, fullname } | null, updatedAt, updatedBy }
 *
 * `budgeted` is the field to branch on, not `yearlyBudget === null`: remote and
 * sick are unbudgeted by design, not merely unset, and must not be offered a
 * yearly input. `primaryAdmin` is null until an admin sets one — there is no
 * "first admin" fallback either here or on the intern's own request form.
 */
export const fetchAbsenceRequestSettings = async () => {
  const { data } = await apiClient.get('/absence-request-settings');
  return data.data.settings;
};

/**
 * PUT /api/absence-request-settings  (admin)
 * @param {{ limits: { [type]: { maxDaysPerRequest?: number, yearlyBudget?: number } },
 *           primaryAdmin?: string|null }} payload
 *
 * A partial merge: types left out keep what they have. Sending `yearlyBudget` for
 * an unbudgeted type is refused rather than ignored. `primaryAdmin` is optional —
 * omit it to leave the current one alone, send a user id to change it, or `null`
 * to clear it (interns then must pick an admin explicitly).
 * → the updated settings, same shape as the fetch
 */
export const updateAbsenceRequestSettings = async (payload) => {
  const { data } = await apiClient.put('/absence-request-settings', payload);
  return data.data.settings;
};

/**
 * DELETE /api/absence-request-settings  (admin) — forget every override and
 * fall back to the shipped defaults.
 * → the updated settings
 */
export const resetAbsenceRequestSettings = async () => {
  const { data } = await apiClient.delete('/absence-request-settings');
  return data.data.settings;
};
