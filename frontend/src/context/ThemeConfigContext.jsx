import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTheme } from 'next-themes';

import { flashThemeTransition } from '@/lib/themeTransition';
import { hasStoredAccessToken } from '@/lib/authStorage';
import { pushPreference } from '@/lib/preferenceSync';
import {
  COLOR_THEME_STORAGE_KEY,
  DEFAULT_COLOR_THEME,
  THEMES,
  isValidColorTheme,
} from '@/lib/themes';
import {
  BOARD_SORT_STORAGE_KEY,
  DEFAULT_BOARD_SORT,
  isValidBoardSort,
} from '@/helpers/boardCardSort';
import {
  NOTIFICATION_MUTED_STORAGE_KEY,
  isValidMutedGroups,
  parseMutedGroups,
  serializeMutedGroups,
} from '@/helpers/notificationPreferences';
import {
  ASSIGNEE_DEFAULT_STORAGE_KEY,
  COLORBLIND_OPTIONS,
  COLORBLIND_STORAGE_KEY,
  CONTRAST_OPTIONS,
  CONTRAST_STORAGE_KEY,
  DEFAULT_ASSIGNEE_DEFAULT,
  DEFAULT_COLORBLIND,
  DEFAULT_CONTRAST,
  DEFAULT_DENSITY,
  DEFAULT_LANDING_PAGE,
  DEFAULT_MOTION,
  DEFAULT_TICKETS_VIEW,
  DEFAULT_UI_SCALE,
  DENSITY_OPTIONS,
  DENSITY_STORAGE_KEY,
  LANDING_PAGE_STORAGE_KEY,
  MOTION_OPTIONS,
  MOTION_STORAGE_KEY,
  TICKETS_VIEW_STORAGE_KEY,
  UI_SCALE_OPTIONS,
  UI_SCALE_STORAGE_KEY,
  isValidAssigneeDefault,
  isValidColorblind,
  isValidContrast,
  isValidDensity,
  isValidLandingPage,
  isValidMotion,
  isValidTicketsView,
  isValidUiScale,
} from '@/helpers/uiPreferences';
import { cacheStoredPreference, readStoredPreference } from '@/hooks/useStoredPreference';

const ThemeConfigContext = createContext(null);

/**
 * Where a preference lives.
 *
 * `ACCOUNT` follows the person: the user record is the source of truth and
 * `localStorage` is a write-through cache in front of it, because the server
 * cannot answer before the first paint.
 *
 * `DEVICE` never leaves this browser.
 */
export const PREFERENCE_SCOPE = { ACCOUNT: 'account', DEVICE: 'device' };

/**
 * Every appearance preference that is expressed as one attribute on <html>.
 * They live in one table because they behave identically — read once, apply,
 * write back on change — and because a new one should cost a row here plus a CSS
 * block in `index.css`, not another bespoke hook.
 *
 * The palette (`data-theme`) is deliberately not in the table: it is the only
 * one that also fires the cross-fade.
 */
const DOM_PREFERENCES = [
  {
    key: 'density',
    attribute: 'data-density',
    storageKey: DENSITY_STORAGE_KEY,
    fallback: DEFAULT_DENSITY,
    isValid: isValidDensity,
    options: DENSITY_OPTIONS,
    scope: PREFERENCE_SCOPE.ACCOUNT,
  },
  {
    key: 'uiScale',
    attribute: 'data-ui-scale',
    storageKey: UI_SCALE_STORAGE_KEY,
    fallback: DEFAULT_UI_SCALE,
    isValid: isValidUiScale,
    options: UI_SCALE_OPTIONS,
    // The one preference that stays per-device. It is a function of physical
    // screen size and viewing distance, not of the person's taste — the answer a
    // 13" laptop wants is not the answer a 27" monitor wants, and syncing it
    // would make one of the two wrong. Everything else on this screen is taste
    // and follows the account. Please do not "fix" this by moving it.
    scope: PREFERENCE_SCOPE.DEVICE,
  },
  {
    key: 'contrast',
    attribute: 'data-contrast',
    storageKey: CONTRAST_STORAGE_KEY,
    fallback: DEFAULT_CONTRAST,
    isValid: isValidContrast,
    options: CONTRAST_OPTIONS,
    scope: PREFERENCE_SCOPE.ACCOUNT,
  },
  {
    key: 'motion',
    attribute: 'data-motion',
    storageKey: MOTION_STORAGE_KEY,
    fallback: DEFAULT_MOTION,
    isValid: isValidMotion,
    options: MOTION_OPTIONS,
    scope: PREFERENCE_SCOPE.ACCOUNT,
  },
  {
    key: 'colorblind',
    attribute: 'data-colorblind',
    storageKey: COLORBLIND_STORAGE_KEY,
    fallback: DEFAULT_COLORBLIND,
    isValid: isValidColorblind,
    options: COLORBLIND_OPTIONS,
    scope: PREFERENCE_SCOPE.ACCOUNT,
  },
];

/** `next-themes` owns light/dark/system, including this storage key. */
export const MODE_STORAGE_KEY = 'theme';

const MODE_VALUES = ['light', 'dark', 'system'];

const isValidMode = (value) => MODE_VALUES.includes(value);

/**
 * The rest of the account's preferences — the ones that are not an attribute on
 * <html>. Same four columns as `DOM_PREFERENCES` so the sync layer can treat both
 * lists identically, plus an optional pair of translators for the one preference
 * whose stored form is not its wire form.
 */
const VALUE_PREFERENCES = [
  { key: 'mode', storageKey: MODE_STORAGE_KEY, fallback: 'system', isValid: isValidMode },
  {
    key: 'colorTheme',
    storageKey: COLOR_THEME_STORAGE_KEY,
    fallback: DEFAULT_COLOR_THEME,
    isValid: isValidColorTheme,
  },
  {
    key: 'landingPage',
    storageKey: LANDING_PAGE_STORAGE_KEY,
    fallback: DEFAULT_LANDING_PAGE,
    isValid: isValidLandingPage,
  },
  {
    key: 'ticketsView',
    storageKey: TICKETS_VIEW_STORAGE_KEY,
    fallback: DEFAULT_TICKETS_VIEW,
    isValid: isValidTicketsView,
  },
  {
    key: 'assigneeDefault',
    storageKey: ASSIGNEE_DEFAULT_STORAGE_KEY,
    fallback: DEFAULT_ASSIGNEE_DEFAULT,
    isValid: isValidAssigneeDefault,
  },
  {
    key: 'boardSort',
    storageKey: BOARD_SORT_STORAGE_KEY,
    fallback: DEFAULT_BOARD_SORT,
    isValid: isValidBoardSort,
  },
  {
    key: 'mutedNotificationGroups',
    storageKey: NOTIFICATION_MUTED_STORAGE_KEY,
    fallback: '',
    isValid: isValidMutedGroups,
    // Cached as one comma-separated string, stored on the user as a real array.
    toServer: parseMutedGroups,
    fromServer: (value) => serializeMutedGroups(Array.isArray(value) ? value : []),
  },
];

/**
 * The single list the sync layer works from: every preference that belongs to
 * the account, whatever shape it takes on screen. `components/UserPreferencesSync.jsx`
 * reads this to turn a `localStorage` write into a PATCH, and nothing else
 * anywhere enumerates the preferences.
 */
export const ACCOUNT_PREFERENCES = [
  ...DOM_PREFERENCES.filter((preference) => preference.scope === PREFERENCE_SCOPE.ACCOUNT).map(
    ({ key, storageKey, fallback, isValid }) => ({ key, storageKey, fallback, isValid })
  ),
  ...VALUE_PREFERENCES,
];

const DEFAULT_DOM_PREFERENCES = Object.fromEntries(
  DOM_PREFERENCES.map((preference) => [preference.key, preference.fallback])
);

function readStoredColorTheme() {
  try {
    const stored = localStorage.getItem(COLOR_THEME_STORAGE_KEY);
    if (stored && isValidColorTheme(stored)) {
      return stored;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_COLOR_THEME;
}

function applyColorThemeToDom(themeId) {
  document.documentElement.setAttribute('data-theme', themeId);
}

/** The value the server sent for `preference`, or `undefined` if it is unusable. */
function serverValueFor(preference, serverPreferences) {
  const raw = serverPreferences?.[preference.key];
  if (raw === undefined || raw === null) return undefined;
  const value = preference.fromServer ? preference.fromServer(raw) : raw;
  if (typeof value !== 'string' || !preference.isValid(value)) return undefined;
  return value;
}

export function ThemeConfigProvider({ children }) {
  const { resolvedTheme, theme, setTheme } = useTheme();
  const [colorTheme, setColorThemeState] = useState(DEFAULT_COLOR_THEME);
  const [preferences, setPreferences] = useState(DEFAULT_DOM_PREFERENCES);
  const [ready, setReady] = useState(false);

  // Refs, not state: the sync layer reads these from inside a callback that must
  // not re-run just because a value moved.
  const colorThemeRef = useRef(DEFAULT_COLOR_THEME);
  const hydratedRef = useRef(false);
  const lastPushedModeRef = useRef(null);

  useEffect(() => {
    // First paint has already happened — `main.jsx`'s IIFE set `data-theme`
    // synchronously. This reconciles React's copy with the cache and applies
    // the remaining attributes.
    //
    // The palette follows the account, so a browser holding no session shows the
    // house palette rather than whatever the last person to sign in here left
    // behind. Same check and same key as the IIFE, or the two would disagree and
    // the login screen would repaint on mount.
    const storedTheme = hasStoredAccessToken() ? readStoredColorTheme() : DEFAULT_COLOR_THEME;
    setColorThemeState(storedTheme);
    colorThemeRef.current = storedTheme;
    applyColorThemeToDom(storedTheme);

    const stored = {};
    DOM_PREFERENCES.forEach((preference) => {
      const value = readStoredPreference(
        preference.storageKey,
        preference.fallback,
        preference.isValid
      );
      stored[preference.key] = value;
      document.documentElement.setAttribute(preference.attribute, value);
    });
    setPreferences(stored);

    setReady(true);
  }, []);

  useEffect(() => {
    if (!resolvedTheme) return;
    document.documentElement.style.colorScheme = resolvedTheme === 'dark' ? 'dark' : 'light';
  }, [resolvedTheme]);

  // Light/dark is the one account preference this provider does not own the
  // writes for — `next-themes` does, straight from Settings. So it is observed
  // rather than intercepted, and only once the server's copy has landed, or the
  // very first render would push the cached value back as if it were a change.
  useEffect(() => {
    if (!ready || !hydratedRef.current) return;
    if (!theme || !isValidMode(theme)) return;
    if (theme === lastPushedModeRef.current) return;
    lastPushedModeRef.current = theme;
    pushPreference(MODE_STORAGE_KEY, theme);
  }, [theme, ready]);

  const setColorTheme = useCallback((themeId) => {
    if (!isValidColorTheme(themeId)) return;
    flashThemeTransition();
    setColorThemeState(themeId);
    colorThemeRef.current = themeId;
    applyColorThemeToDom(themeId);
    try {
      localStorage.setItem(COLOR_THEME_STORAGE_KEY, themeId);
    } catch {
      /* ignore */
    }
    pushPreference(COLOR_THEME_STORAGE_KEY, themeId);
  }, []);

  const setPreference = useCallback((key, next) => {
    const preference = DOM_PREFERENCES.find((entry) => entry.key === key);
    if (!preference || !preference.isValid(next)) return;
    setPreferences((current) => ({ ...current, [key]: next }));
    document.documentElement.setAttribute(preference.attribute, next);
    try {
      localStorage.setItem(preference.storageKey, next);
    } catch {
      /* ignore */
    }
    // A device-scoped row is not in `ACCOUNT_PREFERENCES`, so the pusher drops it.
    pushPreference(preference.storageKey, next);
  }, []);

  /**
   * Reconcile the cache against the user record, once, after sign-in or after a
   * reload with a live session. Called by `components/UserPreferencesSync.jsx`,
   * which is the only thing in the tree that can see both the auth state and the
   * query client.
   *
   * @param {object|null} serverPreferences the merged preferences document
   * @param {boolean} hasStoredPreferences whether the account has ever saved any
   */
  const hydrateFromServer = useCallback(
    (serverPreferences, hasStoredPreferences) => {
      if (!serverPreferences) return;
      hydratedRef.current = true;

      if (!hasStoredPreferences) {
        // Nothing has ever been saved for this account, which is every account
        // the first time it loads a build with this endpoint. Keep what this
        // browser already had and send it up as the account's first saved set,
        // rather than resetting a returning user to the defaults.
        ACCOUNT_PREFERENCES.forEach((preference) => {
          const cached = readStoredPreference(
            preference.storageKey,
            preference.fallback,
            preference.isValid
          );
          if (cached === preference.fallback) return;
          pushPreference(preference.storageKey, cached);
        });
        lastPushedModeRef.current = readStoredPreference(MODE_STORAGE_KEY, 'system', isValidMode);
        return;
      }

      const nextDom = {};

      DOM_PREFERENCES.forEach((preference) => {
        if (preference.scope !== PREFERENCE_SCOPE.ACCOUNT) return;
        const value = serverValueFor(preference, serverPreferences);
        if (value === undefined) return;
        nextDom[preference.key] = value;
        document.documentElement.setAttribute(preference.attribute, value);
        cacheStoredPreference(preference.storageKey, value);
      });

      if (Object.keys(nextDom).length > 0) {
        setPreferences((current) => ({ ...current, ...nextDom }));
      }

      VALUE_PREFERENCES.forEach((preference) => {
        const value = serverValueFor(preference, serverPreferences);
        if (value === undefined) return;

        if (preference.key === 'mode') {
          lastPushedModeRef.current = value;
          // `next-themes` writes its own storage key; going through `setTheme`
          // keeps its state, the `class` on <html> and that key in step.
          setTheme(value);
          return;
        }

        if (preference.key === 'colorTheme') {
          if (colorThemeRef.current === value) return;
          colorThemeRef.current = value;
          setColorThemeState(value);
          applyColorThemeToDom(value);
          return;
        }

        cacheStoredPreference(preference.storageKey, value);
      });
    },
    [setTheme]
  );

  /**
   * Back to the house palette. The auth screens must never wear the previous
   * user's accent — on a shared browser that is one person's choice leaking onto
   * the next person's login screen.
   *
   * The cache is left alone on purpose: it is still the right answer for the
   * moment that user signs back in, and re-reading it is what makes their reload
   * flash-free.
   */
  const resetToDefaultPalette = useCallback(() => {
    hydratedRef.current = false;
    lastPushedModeRef.current = null;
    if (colorThemeRef.current === DEFAULT_COLOR_THEME) return;
    colorThemeRef.current = DEFAULT_COLOR_THEME;
    setColorThemeState(DEFAULT_COLOR_THEME);
    applyColorThemeToDom(DEFAULT_COLOR_THEME);
  }, []);

  const value = useMemo(
    () => ({
      colorTheme,
      setColorTheme,
      themes: THEMES,
      // Spread so callers read `density` / `uiScale` / … directly, the way they
      // did before there was more than one of them.
      ...preferences,
      setPreference,
      preferenceOptions: Object.fromEntries(
        DOM_PREFERENCES.map((preference) => [preference.key, preference.options])
      ),
      ready,
      flashThemeTransition,
      hydrateFromServer,
      resetToDefaultPalette,
    }),
    [
      colorTheme,
      setColorTheme,
      preferences,
      setPreference,
      ready,
      hydrateFromServer,
      resetToDefaultPalette,
    ]
  );

  return <ThemeConfigContext.Provider value={value}>{children}</ThemeConfigContext.Provider>;
}

export function useThemeConfig() {
  const context = useContext(ThemeConfigContext);
  if (!context) {
    throw new Error('useThemeConfig must be used within ThemeConfigProvider');
  }
  return context;
}
