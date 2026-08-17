import apiClient from './axios';

/**
 * The signed-in user's own UI preferences. No id in either path — the server
 * resolves the subject from the bearer token.
 *
 * Both calls answer `{ preferences, hasStoredPreferences }`. The flag is what
 * lets the client tell "this account chose the defaults" apart from "this
 * account has never chosen anything"; see the hydrate step in
 * `context/ThemeConfigContext.jsx`.
 */

const EMPTY = { preferences: null, hasStoredPreferences: false };

const unwrap = (response) => {
  const data = response?.data?.data;
  if (!data?.preferences) return EMPTY;
  return {
    preferences: data.preferences,
    hasStoredPreferences: Boolean(data.hasStoredPreferences),
  };
};

export const getMyPreferences = async () => unwrap(await apiClient.get('/users/me/preferences'));

/**
 * A **partial** patch: send only the keys that changed. The server merges them
 * onto the stored subdocument, so a second browser editing a different
 * preference is not clobbered.
 */
export const updateMyPreferences = async (patch) =>
  unwrap(await apiClient.patch('/users/me/preferences', patch));
