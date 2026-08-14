import apiClient from './axios';

export const registerUser = async (userData) => {
  const response = await apiClient.post('/auth/register', userData);
  return response.data;
};

export const loginUser = async (credentials) => {
  const response = await apiClient.post('/auth/login', credentials);
  return response.data;
};

export const getMe = async () => {
  const response = await apiClient.get('/auth/me');
  return response.data;
};

export const logoutUser = async (refreshToken) => {
  const response = await apiClient.post('/auth/logout', { refreshToken });
  return response.data;
};

export const updateUser = async (id, data) => {
  const response = await apiClient.patch(`/auth/${id}`, data);
  return response.data;
};

/**
 * Change your own password. Takes no id — the server reads the account from the
 * token, so this can only ever act on the caller's own credentials.
 *
 * Answers with a fresh `{ accessToken, refreshToken }`: the change invalidates
 * every token issued under the old password, this session's included.
 */
export const changePassword = async ({ currentPassword, newPassword }) => {
  const response = await apiClient.patch('/auth/me/password', { currentPassword, newPassword });
  return response.data;
};
