import apiClient from '@/api/axios';

export const fetchStaffingRequests = async ({ status, mine, projectId } = {}) => {
  const params = {};
  if (status) params.status = status;
  if (mine) params.mine = 'true';
  if (projectId) params.projectId = projectId;
  const { data } = await apiClient.get('/staffing-requests', { params });
  return data.data;
};

export const createStaffingRequest = async (payload) => {
  const { data } = await apiClient.post('/staffing-requests', payload);
  return data.data;
};

export const updateStaffingRequest = async (id, payload) => {
  const { data } = await apiClient.patch(`/staffing-requests/${id}`, payload);
  return data.data;
};

// Links an unresolved (draft-project) request to an existing project.
export const resolveStaffingRequestProject = async (id, projectId) => {
  const { data } = await apiClient.post(`/staffing-requests/${id}/resolve-project`, { projectId });
  return data.data;
};

// Creates a new project from the admin's own choices and links it in one
// step. `project` is `{ name, client, description, type, status, technologyIds }`.
export const resolveStaffingRequestProjectByCreating = async (id, project) => {
  const { data } = await apiClient.post(`/staffing-requests/${id}/resolve-project/create`, {
    project,
  });
  return data.data;
};

// The interns an admin may put forward for one requested position, already
// partitioned by the server's picker rules: interns who left the programme, and
// interns already in selection for this same position, never appear; the rest
// carry `flags` saying where else they are committed. Clean picks come before
// flagged ones. Returns
// `{ candidates: [{ internProfile, internName, position, technologies, flags, … }] }`.
export const fetchPutForwardCandidates = async (id, positionId) => {
  const { data } = await apiClient.get(
    `/staffing-requests/${id}/positions/${positionId}/candidates`
  );
  return data.data;
};

// Sends a whole staged cart in one act: `groups` is
// `[{ positionId, internProfileIds }]`, one entry per requested position with
// picks on it. Creates one recommendation per pick, tagged back to this request
// with the position forced to the group it was staged under, and applied
// all-or-nothing — a pick that went stale while it was staged rejects the whole
// submit with `data.rejections` naming which rows. Returns the request.
export const putInternsForward = async (id, groups) => {
  const { data } = await apiClient.post(`/staffing-requests/${id}/put-forward`, { groups });
  return data.data;
};

// `reason` is required: 'fulfilled' | 'declined' | 'cancelled'. `note` is
// mandatory for 'declined', optional otherwise — and it lands in a different
// field depending on the reason (see closeStaffingRequest on the server).
export const closeStaffingRequest = async (id, payload) => {
  const { data } = await apiClient.post(`/staffing-requests/${id}/close`, payload);
  return data.data;
};

export const reopenStaffingRequest = async (id) => {
  const { data } = await apiClient.post(`/staffing-requests/${id}/reopen`);
  return data.data;
};

// `{ count, requestIds }` — drives the Requests nav badge on both shells.
export const fetchStaffingRequestNews = async () => {
  const { data } = await apiClient.get('/staffing-requests/news');
  return data.data;
};

// Stamps the caller's last-seen timestamp to now; returns `{ lastSeenAt }`.
export const markStaffingRequestsSeen = async () => {
  const { data } = await apiClient.post('/staffing-requests/seen');
  return data.data;
};

// Full trail for one request, newest first.
export const fetchStaffingRequestHistory = async (id) => {
  const { data } = await apiClient.get(`/staffing-requests/${id}/history`);
  return data.data;
};
