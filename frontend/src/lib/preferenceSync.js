/**
 * The wiring between the two halves of a preference write.
 *
 * `localStorage` is a **write-through cache**; the user record is the source of
 * truth. Every write therefore has to do three things — put the value in the
 * cache, tell the server, and tell the other components already holding that
 * same preference in `useState`.
 *
 * This module deliberately knows *nothing* about which preferences exist. That
 * list lives in one place (`context/ThemeConfigContext.jsx`), and the component
 * that owns it installs the pusher here at runtime. Keeping it list-free is also
 * what keeps `hooks/useStoredPreference.js` free of an import cycle.
 */

export const PREFERENCE_CHANGE_EVENT = 'app:preference-change';

/**
 * Set while a signed-in session is syncing. Null on the auth screens, which is
 * how "logged-out users never fire the preferences call" is enforced at the one
 * choke point every write goes through.
 */
let pushToServer = null;

/**
 * @param {((storageKey: string, value: unknown) => void) | null} fn
 * @returns {() => void} uninstaller — only clears if it is still the one installed
 */
export function setPreferencePusher(fn) {
  pushToServer = fn;
  return () => {
    if (pushToServer === fn) pushToServer = null;
  };
}

/**
 * Offer a written value to the server. A storage key the installed pusher does
 * not recognise (a genuinely per-device preference, or a one-off view toggle) is
 * dropped there, not here.
 */
export function pushPreference(storageKey, value) {
  if (!pushToServer) return;
  try {
    pushToServer(storageKey, value);
  } catch {
    /* a failed save must never take the UI down — the cache already has it */
  }
}

/**
 * Announce a new value to every mounted reader of the same key. Used both by a
 * local write and by the hydrate-from-server step, which is the case that
 * actually needs it: the components read storage on mount, long before the
 * server answers.
 */
export function broadcastPreference(storageKey, value) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(PREFERENCE_CHANGE_EVENT, { detail: { storageKey, value } }));
}

/**
 * @param {string} storageKey
 * @param {(value: unknown) => void} onChange
 * @returns {() => void} unsubscribe
 */
export function subscribeToPreference(storageKey, onChange) {
  if (typeof window === 'undefined') return () => {};

  const handler = (event) => {
    if (event?.detail?.storageKey !== storageKey) return;
    onChange(event.detail.value);
  };

  window.addEventListener(PREFERENCE_CHANGE_EVENT, handler);
  return () => window.removeEventListener(PREFERENCE_CHANGE_EVENT, handler);
}
