import { useCallback, useEffect, useState } from 'react';

import { broadcastPreference, pushPreference, subscribeToPreference } from '@/lib/preferenceSync';

/**
 * The same read, synchronously, for the callers that need the stored value
 * *before* the first paint — a `useState` initialiser whose value decides which
 * of two surfaces renders. Going through the hook there would paint the default
 * and then swap, which is exactly the flash the preference exists to avoid.
 *
 * This reads the **cache**, not the source of truth: for an account preference
 * the server's copy arrives after mount (see `context/ThemeConfigContext.jsx`).
 * That is the trade — a value that is right on this browser immediately beats
 * one that is right everywhere a round trip later.
 *
 * @param {string} storageKey
 * @param {*} defaultValue
 * @param {(value: string) => boolean} isValid
 */
export function readStoredPreference(storageKey, defaultValue, isValid) {
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored && isValid(stored)) return stored;
  } catch {
    /* ignore — private mode, disabled storage */
  }
  return defaultValue;
}

/**
 * The matching write, for callers pairing it with `readStoredPreference` and
 * holding the value in their own `useState`. Same contract: storage errors are
 * swallowed, so a blocked-storage browser keeps working with a preference that
 * simply does not survive the reload.
 *
 * Writing also offers the value to the server and announces it to any other
 * mounted reader of the same key. Both are no-ops for a key that is not an
 * account preference, and the server half is a no-op while nobody is signed in.
 *
 * @param {string} storageKey
 * @param {string} value
 */
export function writeStoredPreference(storageKey, value) {
  try {
    localStorage.setItem(storageKey, value);
  } catch {
    /* ignore — private mode, disabled storage */
  }
  pushPreference(storageKey, value);
  broadcastPreference(storageKey, value);
}

/**
 * Cache-write only: used by the hydrate-from-server step, which must not send
 * the value it just received straight back to where it came from.
 *
 * @param {string} storageKey
 * @param {string} value
 */
export function cacheStoredPreference(storageKey, value) {
  try {
    localStorage.setItem(storageKey, value);
  } catch {
    /* ignore — private mode, disabled storage */
  }
  broadcastPreference(storageKey, value);
}

/**
 * A small UI preference that survives reloads.
 *
 * `localStorage` is a **write-through cache**: read once on mount so the first
 * paint is right, then reconciled against the user record once
 * `ThemeConfigProvider` has hydrated it (which arrives here as a
 * `preferenceSync` broadcast). For the preferences that are genuinely
 * per-device, and for one-off view toggles that were never account settings,
 * the cache is simply all there is.
 *
 * Same error contract as the colour theme: validate what came back and swallow
 * storage errors so a locked-down browser degrades to the default instead of
 * throwing. Reading in an effect rather than in `useState`'s initialiser keeps
 * the first render identical for every visitor, which matters because these
 * components also render on a hydrated page.
 *
 * @param {string} storageKey
 * @param {*} defaultValue returned until storage is read, and whenever the
 *   stored value fails `isValid`
 * @param {(value: string) => boolean} isValid guards against a stale value left
 *   by an older build — an unrecognised one falls back rather than rendering
 *   nothing
 */
export function useStoredPreference(storageKey, defaultValue, isValid) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored && isValid(stored)) setValue(stored);
    } catch {
      /* ignore — private mode, disabled storage */
    }

    // Another holder of this key changed it, or the server's copy just landed.
    // Without this, Settings and the control on the page it configures would
    // disagree until the next reload.
    return subscribeToPreference(storageKey, (next) => {
      if (typeof next !== 'string' || !isValid(next)) return;
      setValue((current) => (current === next ? current : next));
    });
    // `isValid` is a module-level predicate at every call site; re-reading
    // storage when it changes identity would fight a caller that inlines it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const update = useCallback(
    (next) => {
      if (!isValid(next)) return;
      setValue(next);
      writeStoredPreference(storageKey, next);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [storageKey]
  );

  return [value, update];
}
