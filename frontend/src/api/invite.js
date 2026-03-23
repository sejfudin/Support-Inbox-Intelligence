import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
});

export const verifyInvite = async ({ token, email }) => {
  const res = await api.post("/auth/invite/verify", { token, email });
  return res.data;
};

export const setPasswordFromInvite = async (password) => {
  const res = await api.post("/auth/invite/set-password", { password });
  return res.data;
};
