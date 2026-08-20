/**
 * Absence request API layer (server/routes/absenceRequest.js).
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
 * in exactly one place: `server/helpers/absenceRequestRules.js`.
 */

import apiClient from '@/api/axios';

/**
 * GET /api/absence-requests/me  (intern)
 * → { requests: [{ id, type, dates, status, reason, decisionNote, decidedAt, decidedBy,
 *                  recipientAdmin: { id, fullname } | null }],
 *     types: [{ type, label, maxDaysPerRequest, earliestDate, latestDate,
 *               budget: { budget, used, remaining } | null }],
 *     admins: [{ id, fullname }], primaryAdmin: { id, fullname } | null }
 *
 * `admins`/`primaryAdmin` are what the "Send to" picker renders from — the same
 * "everything the form needs, no second source to disagree with" bargain `types`
 * already makes, so there is no separate "list the admins" call.
 */
export const fetchMyAbsenceRequests = async () => {
  const { data } = await apiClient.get('/absence-requests/me');
  return data.data.absenceRequests;
};

/**
 * POST /api/absence-requests/me  (intern) — ask for days of one type, addressed
 * to one admin.
 * @param {{ type: string, dates: string[], reason?: string, recipientAdmin?: string }} payload
 *   - dates are 'yyyy-MM-dd'; recipientAdmin is a user id, defaulting server-side
 *     to the configured primary admin when omitted
 * → the updated list, same shape as fetchMyAbsenceRequests
 */
export const createAbsenceRequest = async (payload) => {
  const { data } = await apiClient.post('/absence-requests/me', payload);
  return data.data.absenceRequests;
};

/**
 * DELETE /api/absence-requests/me/:id  (intern) — withdraw a pending request.
 * → the updated list
 */
export const cancelAbsenceRequest = async (id) => {
  const { data } = await apiClient.delete(`/absence-requests/me/${id}`);
  return data.data.absenceRequests;
};

/**
 * GET /api/absence-requests?status=pending|all&type=remote|…  (admin)
 * → { requests: [{ id, type, dates, …, intern: { id, fullname, email, hub },
 *                  recipientAdmin: { id, fullname } | null }],
 *     pendingCount, pendingByType }
 *
 * Unfiltered by recipient — every admin sees and can decide every request here,
 * same as before `recipientAdmin` existed. It only targets the notification and
 * the row's "For" tag, never who may act on it.
 *
 * `pendingCount` is deliberately unfiltered, so the nav dot and the tab badge keep
 * meaning "anything waiting" even while a type filter is applied.
 */
export const fetchAbsenceRequests = async (params = {}) => {
  const { data } = await apiClient.get('/absence-requests', { params });
  return data.data.absenceRequests;
};

/**
 * PATCH /api/absence-requests/:id  (admin) — approve or reject a pending request.
 * Approving writes the intern's attendance rows for every day in it.
 * @param {{ id: string, decision: 'approved'|'rejected', note?: string }} payload
 */
export const decideAbsenceRequest = async ({ id, decision, note }) => {
  const { data } = await apiClient.patch(`/absence-requests/${id}`, { decision, note });
  return data.data.absenceRequests;
};

/**
 * DELETE /api/absence-requests/:id  (admin) — undo an approval, removing the
 * attendance rows it created.
 */
export const revokeAbsenceRequest = async ({ id, note }) => {
  const { data } = await apiClient.delete(`/absence-requests/${id}`, { data: { note } });
  return data.data.absenceRequests;
};
