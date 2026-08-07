import { useCallback, useEffect, useState } from 'react';

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
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored && isValid(stored)) setValue(stored);
    } catch {
      /* ignore — private mode, disabled storage */
    }
    // `isValid` is a module-level predicate at every call site; re-reading
    // storage when it changes identity would fight a caller that inlines it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const update = useCallback(
    (next) => {
      if (!isValid(next)) return;
      setValue(next);
      try {
        localStorage.setItem(storageKey, next);
      } catch {
        /* ignore */
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [storageKey]
  );

  return [value, update];
}
