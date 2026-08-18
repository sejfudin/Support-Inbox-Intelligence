import apiClient, { authorizationHeader } from './axios';

/**
 * The signed-in user's own UI preferences. No id in either path — the server
 * resolves the subject from the bearer token.
 *
 * Both calls answer `{ preferences, storedKeys }`. `storedKeys` names the
 * preferences this account has actually saved, so the client can take the
 * server's answer for those and leave a locally-set preference the account never
 * saved alone. See the hydrate step in `context/ThemeConfigContext.jsx`.
 */

const PREFERENCES_PATH = '/users/me/preferences';

const EMPTY = { preferences: null, storedKeys: [] };

const unwrap = (response) => {
  const data = response?.data?.data;
  if (!data?.preferences) return EMPTY;
  return {
    preferences: data.preferences,
    // A server that predates `storedKeys` reads as "nothing saved", which makes
    // the client keep this browser's values and push them up rather than reset
    // them. That is the harmless direction to be wrong in, and it self-heals on
    // the first save.
    storedKeys: Array.isArray(data.storedKeys) ? data.storedKeys : [],
  };
};

export const getMyPreferences = async () => unwrap(await apiClient.get(PREFERENCES_PATH));

/**
 * A **partial** patch: send only the keys that changed. The server merges them
 * onto the stored subdocument, so a second browser editing a different
 * preference is not clobbered.
 */
export const updateMyPreferences = async (patch) =>
  unwrap(await apiClient.patch(PREFERENCES_PATH, patch));

/**
 * The same patch, for the moment the page is going away — a tab close, a
 * navigation, a backgrounded mobile tab. `fetch` with `keepalive` outlives the
 * document; an axios request does not, so a preference changed in the last
 * fraction of a second before unload would otherwise be lost.
 *
 * Deliberately fire-and-forget, and deliberately outside the axios interceptors:
 * there is nobody left to retry or to refresh an expired token for. If it fails,
 * the value is still in the cache and the next session pushes it. The bearer
 * header still comes from `authorizationHeader()` in `api/axios.js`, so this
 * skips the interceptors without also forking how the token is read.
 *
 * @returns {boolean} whether a request was dispatched at all
 */
export const flushMyPreferences = (patch) => {
  if (!patch || Object.keys(patch).length === 0) return false;
  try {
    const auth = authorizationHeader();
    if (!auth.Authorization) return false;
    fetch(`${apiClient.defaults.baseURL}${PREFERENCES_PATH}`, {
      method: 'PATCH',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify(patch),
    }).catch(() => {
      /* the page is leaving — there is no one to tell */
    });
    return true;
  } catch {
    return false;
  }
};
