/**
 * Where the session lives. `api/axios.js` and `context/AuthContext.jsx` own
 * reading and writing it; this module exists so the handful of places that only
 * need to ask *"is anyone signed in right now?"* — synchronously, before React
 * mounts — can do it without hard-coding the key a fourth time.
 */

export const ACCESS_TOKEN_STORAGE_KEY = 'accessToken';

export const REFRESH_TOKEN_STORAGE_KEY = 'refreshToken';

/**
 * Synchronous, so it can run inside the pre-paint IIFE in `main.jsx` and in a
 * `useState` initialiser. This is "there is a session token in this browser",
 * not "the token is still valid" — the server is the only thing that can answer
 * the second question, and by then we have already had to paint.
 */
export function hasStoredAccessToken() {
  try {
    return Boolean(localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY));
  } catch {
    /* private mode, disabled storage — treat as signed out */
    return false;
  }
}
