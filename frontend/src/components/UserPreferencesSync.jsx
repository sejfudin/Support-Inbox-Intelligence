import { useCallback, useEffect, useRef } from 'react';

import { flushMyPreferences } from '@/api/userPreferences';
import { useAuth } from '@/context/AuthContext';
import { ACCOUNT_PREFERENCES, useThemeConfig } from '@/context/ThemeConfigContext';
import { hasStoredAccessToken } from '@/lib/authStorage';
import { setPreferencePusher } from '@/lib/preferenceSync';
import { useMyPreferences, useUpdateMyPreferences } from '@/queries/userPreferences';
import { resolveUserId } from '@/helpers/userIdentity';

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
 * 3. On sign-out, put the appearance back to the house default so the login
 *    screen does not wear the last user's accent or accessibility settings.
 *
 * Signed out, no pusher is installed and the query is disabled — which is how
 * the auth screens never fire a preferences call.
 */

/** The account preferences, indexed the way a write arrives: by storage key. */
const BY_STORAGE_KEY = new Map(
  ACCOUNT_PREFERENCES.map((preference) => [preference.storageKey, preference])
);

// Long enough to collapse a click-through of Settings into one request, short
// enough that a user who changes one thing and closes the tab still saves — and
// the close itself is covered by the exit flush below.
const SAVE_DEBOUNCE_MS = 300;

// A patch that failed goes back on the queue and is retried a few times before it
// is left to the next change (or the exit flush) to carry. Bounded on purpose: an
// offline tab must not sit in a retry loop for the rest of the afternoon.
const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = 4000;

export default function UserPreferencesSync() {
  const { isAuthenticated, user } = useAuth();
  const { hydrateFromServer, markSyncUnavailable, resetToDefaultAppearance } = useThemeConfig();
  const { data, isError } = useMyPreferences({ enabled: isAuthenticated });
  const { mutate: savePreferences } = useUpdateMyPreferences();

  const pendingRef = useRef({});
  const timerRef = useRef(null);
  const retriesRef = useRef(0);
  const hydratedRef = useRef(false);
  // `flush` reschedules itself after a failure; the ref is how it reaches its own
  // current identity from inside a callback that outlives the render.
  const flushRef = useRef(null);

  const flush = useCallback(() => {
    timerRef.current = null;
    const patch = pendingRef.current;
    if (Object.keys(patch).length === 0) return;
    pendingRef.current = {};

    savePreferences(patch, {
      onSuccess: () => {
        retriesRef.current = 0;
      },
      onError: () => {
        // Put the patch back rather than dropping it. Anything queued while the
        // request was in flight is newer, so it wins the spread.
        pendingRef.current = { ...patch, ...pendingRef.current };
        retriesRef.current += 1;
        if (retriesRef.current > MAX_RETRIES || timerRef.current) return;
        timerRef.current = setTimeout(
          () => flushRef.current?.(),
          RETRY_BACKOFF_MS * retriesRef.current
        );
      },
    });
  }, [savePreferences]);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

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
      timerRef.current = setTimeout(() => flushRef.current?.(), SAVE_DEBOUNCE_MS);
    });

    return () => {
      uninstall();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      const patch = pendingRef.current;
      pendingRef.current = {};
      if (Object.keys(patch).length === 0) return;

      // A token is still here, so this is an unmount or a navigation rather than a
      // sign-out: send the queue instead of letting the debounce window eat the
      // user's last change. With no token there is nothing to send it with — the
      // request would only 401, and the cache kept the value either way.
      if (hasStoredAccessToken()) flushMyPreferences(patch);
    };
    // Deliberately only the auth state: re-running this would tear the pusher down
    // mid-session and send a half-collected patch through the cleanup above.
  }, [isAuthenticated]);

  // The page going away is the one case a 300 ms debounce cannot survive on its
  // own: `pagehide` and the switch to hidden are the last points at which a
  // request can still be started, and only a `keepalive` one outlives the
  // document.
  useEffect(() => {
    if (!isAuthenticated) return undefined;

    const flushOnExit = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      const patch = pendingRef.current;
      if (Object.keys(patch).length === 0) return;
      if (flushMyPreferences(patch)) pendingRef.current = {};
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushOnExit();
    };

    window.addEventListener('pagehide', flushOnExit);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', flushOnExit);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || hydratedRef.current) return;

    // The read is `staleTime: Infinity` and retried a couple of times, so a
    // failure here means it is not coming this session. Say so rather than leaving
    // the provider waiting: light/dark is gated on hydration and would otherwise
    // stop persisting silently while every other preference kept saving.
    if (isError) {
      hydratedRef.current = true;
      markSyncUnavailable();
      return;
    }

    if (!data?.preferences) return;
    hydratedRef.current = true;
    hydrateFromServer(data.preferences, {
      storedKeys: data.storedKeys,
      userId: resolveUserId(user),
    });
  }, [isAuthenticated, isError, data, user, hydrateFromServer, markSyncUnavailable]);

  useEffect(() => {
    if (isAuthenticated) return;
    // A reload with a live session sits here for a beat while `/auth/me`
    // resolves. The token is the synchronous way to tell that apart from being
    // genuinely signed out, and resetting during it would flash the default
    // palette on every single load — the regression this whole design avoids.
    if (hasStoredAccessToken()) return;
    hydratedRef.current = false;
    resetToDefaultAppearance();
  }, [isAuthenticated, resetToDefaultAppearance]);

  return null;
}
