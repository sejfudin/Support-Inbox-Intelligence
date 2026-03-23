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
}

export const logoutUser = async () => {
    const response = await apiClient.post('/auth/logout');
    return response.data;
};

export const updateUser = async (id, data) => {
  const response = await apiClient.patch(`/auth/${id}`, data);
  return response.data;
};