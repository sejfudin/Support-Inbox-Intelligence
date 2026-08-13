/**
 * Remote-work request API layer (server/routes/remoteWork.js).
 *
 * An intern asks for 1–3 days in one request and an admin decides the request as
 * a unit; an approval writes one attendance row per day, so nothing here is a
 * check-in and the 07:00–11:00 window does not apply. Wanting a fourth day means
 * another request, and there is no limit on how many of those. The server owns
 * every rule the client only hints at (`server/helpers/remoteWorkRules.js`).
 */

import apiClient from '@/api/axios';

/**
 * GET /api/remote-work/me  (intern)
 * → { requests: [{ id, dates, status, reason, decisionNote, decidedAt, decidedBy }],
 *     maxDaysPerRequest }
 */
export const fetchMyRemoteWork = async () => {
  const { data } = await apiClient.get('/remote-work/me');
  return data.data.remoteWork;
};

/**
 * POST /api/remote-work/me  (intern) — ask to work remotely on 1–3 days.
 * @param {{ dates: string[], reason?: string }} payload - each date is 'yyyy-MM-dd'
 * → the updated list, same shape as fetchMyRemoteWork
 */
export const createRemoteWorkRequest = async (payload) => {
  const { data } = await apiClient.post('/remote-work/me', payload);
  return data.data.remoteWork;
};

/**
 * DELETE /api/remote-work/me/:id  (intern) — withdraw a request that is still pending.
 * → the updated list
 */
export const cancelRemoteWorkRequest = async (id) => {
  const { data } = await apiClient.delete(`/remote-work/me/${id}`);
  return data.data.remoteWork;
};

/**
 * GET /api/remote-work?status=pending|all  (admin)
 * → { requests: [{ id, dates, status, …, intern: { id, fullname, email, hub } }], pendingCount }
 */
export const fetchRemoteWorkRequests = async (params = {}) => {
  const { data } = await apiClient.get('/remote-work', { params });
  return data.data.remoteWork;
};

/**
 * PATCH /api/remote-work/:id  (admin) — approve or reject a pending request.
 * Approving writes the intern's attendance row for that day.
 * @param {{ id: string, decision: 'approved'|'rejected', note?: string }} payload
 */
export const decideRemoteWorkRequest = async ({ id, decision, note }) => {
  const { data } = await apiClient.patch(`/remote-work/${id}`, { decision, note });
  return data.data.remoteWork;
};

/**
 * DELETE /api/remote-work/:id  (admin) — undo an approval, removing the
 * attendance row it created.
 */
export const revokeRemoteWorkRequest = async ({ id, note }) => {
  const { data } = await apiClient.delete(`/remote-work/${id}`, { data: { note } });
  return data.data.remoteWork;
};
