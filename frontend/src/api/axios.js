import axios from 'axios';
import {
  ACCESS_TOKEN_STORAGE_KEY,
  REFRESH_TOKEN_STORAGE_KEY,
  readAccessToken,
} from '@/lib/authStorage';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

/**
 * The one place a bearer header is built. The request interceptor below is its
 * main caller; it is exported for the rare request that cannot go through axios
 * at all — see the `keepalive` flush in `api/userPreferences.js` — so that even
 * those build the header here rather than reading the token themselves.
 *
 * Returns `{}` when there is no session, so it can be spread unconditionally.
 */
export const authorizationHeader = () => {
  const token = readAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

apiClient.interceptors.request.use(
  (config) => {
    Object.assign(config.headers, authorizationHeader());
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url.includes('/auth/login') &&
      !originalRequest.url.includes('/auth/refresh')
    ) {
      if (isRefreshing) {
        return new Promise(function (resolve, reject) {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = 'Bearer ' + token;
            return apiClient(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);

        if (!storedRefreshToken) {
          throw new Error('No refresh token available');
        }

        const response = await axios.post(`${apiClient.defaults.baseURL}/auth/refresh`, {
          refreshToken: storedRefreshToken,
        });

        const { accessToken, refreshToken } = response.data;
        const token = accessToken;

        if (!token) {
          throw new Error('No token returned from refresh');
        }

        localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
        if (refreshToken) {
          localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
        }
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;

        processQueue(null, token);

        originalRequest.headers.Authorization = `Bearer ${token}`;
        return apiClient(originalRequest);
      } catch (err) {
        processQueue(err, null);
        localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
        localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
        window.location.href = '/login';

        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
