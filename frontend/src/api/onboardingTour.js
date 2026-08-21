import apiClient from './axios';

/**
 * The what's-new tour's seen-state, on the account rather than in one browser.
 * No id in the path — the server resolves the subject from the bearer token.
 *
 * There is no matching read: `whatsNewSeenVersion` rides along on `GET /auth/me`
 * with the rest of the user document, so the shell already has the answer by the
 * time the tour can ask for it.
 *
 * Called from `components/onboarding/whatsNewSteps.js` rather than through a
 * React Query hook, and deliberately so: every read and write of the seen-state
 * is meant to live inside that one module, and a mutation hook would put the
 * request back in the components' hands. Same shape as `flushMyPreferences` in
 * `api/userPreferences.js` — an imperative write nobody re-renders on.
 */
export const markWhatsNewSeenOnAccount = async (version) => {
  const response = await apiClient.patch('/users/me/whats-new-seen', { version });
  return response?.data?.data ?? null;
};
