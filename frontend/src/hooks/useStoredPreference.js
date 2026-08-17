import { useCallback, useEffect, useState } from 'react';

/**
 * Read a stored preference, for callers that need the value before first paint.
 *
 * A route redirect or a `useState` initialiser cannot wait for an effect — by
 * the time one runs the redirect has already gone to the default. Those callers
 * read straight through instead, and accept that the first render differs
 * between browser profiles.
 *
 * @param {string} storageKey
 * @param {*} defaultValue returned when nothing is stored, when the stored value
 *   fails `isValid`, or when storage throws
 * @param {(value: string) => boolean} isValid
 */
export function readStoredPreference(storageKey, defaultValue, isValid) {
  try {
    const stored = localStorage.getItem(storageKey);
    return stored && isValid(stored) ? stored : defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * The matching write, for callers that hold the value in their own state.
 *
 * Unvalidated on purpose: the caller already knows the value is one of its own,
 * and a guard here would need the predicate passed in for no gain.
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
}

/**
 * A small UI preference that survives reloads, stored in `localStorage`.
 *
 * Same shape as the colour theme (`context/ThemeConfigContext.jsx`): read once on
 * mount, validate what came back, and swallow storage errors so a locked-down
 * browser degrades to the default instead of throwing. Reading in an effect
 * rather than in `useState`'s initialiser keeps the first render identical for
 * every visitor, which matters because these components also render on a
 * hydrated page.
 *
 * Like the theme, this is per browser profile rather than per account — a second
 * device starts on the default. Anything that needs to follow the *user* belongs
 * on the `User` model behind an endpoint, not here.
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
    setValue(readStoredPreference(storageKey, defaultValue, isValid));
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
