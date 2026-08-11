import apiClient from '@/api/axios';

export const fetchStaffingRequests = async ({ status, mine } = {}) => {
  const params = {};
  if (status) params.status = status;
  if (mine) params.mine = 'true';
  const { data } = await apiClient.get('/staffing-requests', { params });
  return data.data;
};

export const fetchStaffingRequest = async (id) => {
  const { data } = await apiClient.get(`/staffing-requests/${id}`);
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

export const setStaffingRequestNote = async (id, payload) => {
  const { data } = await apiClient.patch(`/staffing-requests/${id}/note`, payload);
  return data.data;
};
