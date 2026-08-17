import { useCallback, useEffect, useRef } from 'react';

import { useAuth } from '@/context/AuthContext';
import { ACCOUNT_PREFERENCES, useThemeConfig } from '@/context/ThemeConfigContext';
import { hasStoredAccessToken } from '@/lib/authStorage';
import { setPreferencePusher } from '@/lib/preferenceSync';
import { useMyPreferences, useUpdateMyPreferences } from '@/queries/userPreferences';

/**
 * Renders nothing. It exists to sit at the one point in the tree that can see
 * all three things the preference sync needs — the auth state, the query client
 * and `ThemeConfigProvider` — because `ThemeConfigProvider` itself is mounted
 * above both of the others in `main.jsx`, and has to stay there so the first
 * paint is not waiting on React Query.
 *
 * Its whole job:
 *
 * 1. While signed in, install the pusher every `localStorage` preference write
 *    goes through, and batch those writes into one PATCH.
 * 2. Once the user record arrives, reconcile the cache against it.
 * 3. On sign-out, put the palette back to the house default so the login screen
 *    does not wear the last user's accent.
 *
 * Signed out, no pusher is installed and the query is disabled — which is how
 * the auth screens never fire a preferences call.
 */

/** The account preferences, indexed the way a write arrives: by storage key. */
const BY_STORAGE_KEY = new Map(
  ACCOUNT_PREFERENCES.map((preference) => [preference.storageKey, preference])
);

// Long enough to collapse a click-through of Settings into one request, short
// enough that a user who changes one thing and closes the tab still saves.
const SAVE_DEBOUNCE_MS = 300;

export default function UserPreferencesSync() {
  const { isAuthenticated } = useAuth();
  const { hydrateFromServer, resetToDefaultPalette } = useThemeConfig();
  const { data } = useMyPreferences({ enabled: isAuthenticated });
  const { mutate: savePreferences } = useUpdateMyPreferences();

  const pendingRef = useRef({});
  const timerRef = useRef(null);
  const hydratedRef = useRef(false);

  const flush = useCallback(() => {
    timerRef.current = null;
    const patch = pendingRef.current;
    pendingRef.current = {};
    if (Object.keys(patch).length === 0) return;
    savePreferences(patch);
  }, [savePreferences]);

  // Declared before the hydrate effect on purpose: hydration can itself push (the
  // first-run migration below), and the pusher has to be installed by then.
  useEffect(() => {
    if (!isAuthenticated) return undefined;

    const uninstall = setPreferencePusher((storageKey, value) => {
      const preference = BY_STORAGE_KEY.get(storageKey);
      // Not an account preference: a per-device one like UI scale, or a one-off
      // view toggle that was never a setting. Those stay in the cache and stop here.
      if (!preference) return;

      pendingRef.current = {
        ...pendingRef.current,
        [preference.key]: preference.toServer ? preference.toServer(value) : value,
      };

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
    });

    return () => {
      uninstall();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      // Whatever was still queued belonged to a session that no longer has a
      // token; sending it would only 401. The cache kept it either way.
      pendingRef.current = {};
    };
  }, [isAuthenticated, flush]);

  useEffect(() => {
    if (!isAuthenticated || !data?.preferences || hydratedRef.current) return;
    hydratedRef.current = true;
    hydrateFromServer(data.preferences, data.hasStoredPreferences);
  }, [isAuthenticated, data, hydrateFromServer]);

  useEffect(() => {
    if (isAuthenticated) return;
    // A reload with a live session sits here for a beat while `/auth/me`
    // resolves. The token is the synchronous way to tell that apart from being
    // genuinely signed out, and resetting during it would flash the default
    // palette on every single load — the regression this whole design avoids.
    if (hasStoredAccessToken()) return;
    hydratedRef.current = false;
    resetToDefaultPalette();
  }, [isAuthenticated, resetToDefaultPalette]);

  return null;
}
