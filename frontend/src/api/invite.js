import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

export const verifyInvite = async ({ token, email }) => {
  const res = await api.post('/auth/invite/verify', { token, email });
  return res.data;
};

export const setPasswordFromInvite = async (password, setupToken) => {
  const res = await api.post('/auth/invite/set-password', { password, setupToken });
  return res.data;
};
