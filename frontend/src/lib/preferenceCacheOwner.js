/**
 * Who the `localStorage` preference cache belongs to.
 *
 * Sign-out deliberately leaves the cache in place — it is what makes the next
 * sign-in flash-free. On a shared browser that means the cache the next person
 * finds is the previous person's, and the first-run migration (see
 * `hydrateFromServer` in `context/ThemeConfigContext.jsx`) would otherwise adopt
 * it and save it onto *their* account. Stamping the owner is how the migration
 * tells "these are my settings from last time" from "these are a stranger's".
 *
 * Only an id is stored, and only one — this is not a per-user cache, just a claim
 * on the single one there is.
 */

const OWNER_STORAGE_KEY = 'preferenceCacheOwner';

/** @returns {string|null} null when nothing has claimed the cache yet */
export function readPreferenceCacheOwner() {
  try {
    return localStorage.getItem(OWNER_STORAGE_KEY) || null;
  } catch {
    /* private mode, disabled storage */
    return null;
  }
}

export function writePreferenceCacheOwner(userId) {
  if (!userId) return;
  try {
    localStorage.setItem(OWNER_STORAGE_KEY, String(userId));
  } catch {
    /* ignore — the migration simply stays conservative next time */
  }
}

/**
 * Whether the cached values may be treated as this user's own.
 *
 * - Stamped with their id: yes, unambiguously.
 * - Stamped with somebody else's: no.
 * - Unstamped (the state every browser is in before this feature shipped): only
 *   if the session was already live when the tab loaded. A reload carrying a
 *   token belongs to the person who wrote that cache; a fresh sign-in on a
 *   browser nobody has claimed could be anyone, and adopting there is exactly
 *   the leak this guards.
 *
 * @param {string|null} userId
 * @param {boolean} sessionWasLiveAtMount
 */
export function preferenceCacheIsOwnedBy(userId, sessionWasLiveAtMount) {
  const owner = readPreferenceCacheOwner();
  if (owner) return Boolean(userId) && owner === String(userId);
  return Boolean(sessionWasLiveAtMount);
}
