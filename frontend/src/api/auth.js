import apiClient from './axios'; 

export const registerUser = async (userData) => {
    const response = await apiClient.post('/auth/register', userData);
    return response.data;
};