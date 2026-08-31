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
import { preferenceCacheIsOwnedBy, writePreferenceCacheOwner } from '@/lib/preferenceCacheOwner';
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
  QUICK_ACTIONS_NONE,
  QUICK_ACTIONS_STORAGE_KEY,
  decodeQuickActionSelection,
  encodeQuickActionSelection,
  isValidQuickActionOrder,
} from '@/helpers/quickActions';
import {
  DEFAULT_ONBOARDING_ENABLED,
  ONBOARDING_ENABLED_STORAGE_KEY,
  isValidOnboardingEnabled,
} from '@/helpers/onboardingTour';
import {
  DESKTOP_NOTIFICATIONS_DEFAULT,
  DESKTOP_NOTIFICATIONS_STORAGE_KEY,
  isValidDesktopNotifications,
} from '@/helpers/desktopNotifications';
import { NAV_SECTIONS_STORAGE_KEY, isValidClosedSections } from '@/helpers/navSections';
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
  DEFAULT_NAV_STYLE,
  DENSITY_OPTIONS,
  DENSITY_STORAGE_KEY,
  LANDING_PAGE_STORAGE_KEY,
  NAV_STYLE_STORAGE_KEY,
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
  isValidNavStyle,
  isValidTicketsView,
  isValidUiScale,
} from '@/helpers/uiPreferences';
import {
  cacheStoredPreference,
  readStoredPreference,
  writeStoredPreference,
} from '@/hooks/useStoredPreference';

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
  {
    key: 'mode',
    storageKey: MODE_STORAGE_KEY,
    fallback: 'system',
    isValid: isValidMode,
    scope: PREFERENCE_SCOPE.ACCOUNT,
  },
  {
    key: 'colorTheme',
    storageKey: COLOR_THEME_STORAGE_KEY,
    fallback: DEFAULT_COLOR_THEME,
    isValid: isValidColorTheme,
    scope: PREFERENCE_SCOPE.ACCOUNT,
  },
  {
    // Collapsible vs labelled sidebar groups. Taste, so it follows the account —
    // unlike `navSections` below it, which records *which* groups are closed and
    // stays per-device.
    key: 'navStyle',
    storageKey: NAV_STYLE_STORAGE_KEY,
    fallback: DEFAULT_NAV_STYLE,
    isValid: isValidNavStyle,
    scope: PREFERENCE_SCOPE.ACCOUNT,
  },
  {
    key: 'landingPage',
    storageKey: LANDING_PAGE_STORAGE_KEY,
    fallback: DEFAULT_LANDING_PAGE,
    isValid: isValidLandingPage,
    scope: PREFERENCE_SCOPE.ACCOUNT,
  },
  {
    key: 'ticketsView',
    storageKey: TICKETS_VIEW_STORAGE_KEY,
    fallback: DEFAULT_TICKETS_VIEW,
    isValid: isValidTicketsView,
    scope: PREFERENCE_SCOPE.ACCOUNT,
  },
  {
    key: 'assigneeDefault',
    storageKey: ASSIGNEE_DEFAULT_STORAGE_KEY,
    fallback: DEFAULT_ASSIGNEE_DEFAULT,
    isValid: isValidAssigneeDefault,
    scope: PREFERENCE_SCOPE.ACCOUNT,
  },
  {
    key: 'boardSort',
    storageKey: BOARD_SORT_STORAGE_KEY,
    fallback: DEFAULT_BOARD_SORT,
    isValid: isValidBoardSort,
    scope: PREFERENCE_SCOPE.ACCOUNT,
  },
  {
    key: 'mutedNotificationGroups',
    storageKey: NOTIFICATION_MUTED_STORAGE_KEY,
    fallback: '',
    isValid: isValidMutedGroups,
    scope: PREFERENCE_SCOPE.ACCOUNT,
    // Cached as one comma-separated string, stored on the user as a real array.
    toServer: parseMutedGroups,
    fromServer: (value) => serializeMutedGroups(Array.isArray(value) ? value : []),
  },
  {
    key: 'quickActions',
    storageKey: QUICK_ACTIONS_STORAGE_KEY,
    fallback: '',
    isValid: isValidQuickActionOrder,
    scope: PREFERENCE_SCOPE.ACCOUNT,
    // Cached as one comma-separated string of action keys, stored on the user as
    // a real ordered array — the same trick as the muted groups above.
    //
    // Three states, not two, and the mapping is where they are kept apart:
    //
    // - `''` → `null`: never chosen. `null` makes the server `$unset` the key, so
    //   Reset means "as shipped" and a later change to the catalog still reaches
    //   this account — a stored copy of today's default would pin it forever.
    // - `'none'` → `[]`: chose to have no quick actions. A real stored value.
    // - a list → the keys, in order.
    //
    // Coming back the other way, `[]` can only be the deliberate empty selection:
    // `hydrateFromServer` reads a preference off the record only when `storedKeys`
    // says the account saved it, so an untouched account never lands here.
    toServer: (value) => (value === '' ? null : decodeQuickActionSelection(value)),
    fromServer: (value) =>
      Array.isArray(value) ? encodeQuickActionSelection(value) : QUICK_ACTIONS_NONE,
  },
  {
    key: 'navSections',
    storageKey: NAV_SECTIONS_STORAGE_KEY,
    // Nothing closed. Stored as one comma-separated list of the sections that
    // *are* closed, so a section added in a later release is absent from every
    // stored list and therefore open — no migration, same trick as the muted
    // notification groups above.
    fallback: '',
    isValid: isValidClosedSections,
    // The third per-device row, and for the `uiScale` reason rather than the
    // `desktopNotifications` one: which sections you collapse is a function of how
    // much vertical room the screen has, not of taste. Ten admin rows do not fit a
    // 13" laptop and need no fixing on a 27" monitor, so syncing it would carry
    // the laptop's compromise onto the desktop.
    scope: PREFERENCE_SCOPE.DEVICE,
  },
  {
    key: 'desktopNotifications',
    storageKey: DESKTOP_NOTIFICATIONS_STORAGE_KEY,
    fallback: DESKTOP_NOTIFICATIONS_DEFAULT,
    isValid: isValidDesktopNotifications,
    // The second per-device row, for the same reason as `uiScale`: the browser
    // grants notification permission per browser, per device, so a synced switch
    // would read "on" where nothing could ever draw. It sits in the table
    // anyway — the table is where a preference is declared, whether or not the
    // sync layer ends up carrying it.
    scope: PREFERENCE_SCOPE.DEVICE,
  },
  {
    key: 'onboardingTourEnabled',
    storageKey: ONBOARDING_ENABLED_STORAGE_KEY,
    fallback: DEFAULT_ONBOARDING_ENABLED,
    isValid: isValidOnboardingEnabled,
    scope: PREFERENCE_SCOPE.ACCOUNT,
  },
];

/**
 * The single list the sync layer works from: every preference that belongs to
 * the account, whatever shape it takes on screen. `components/UserPreferencesSync.jsx`
 * reads this to turn a `localStorage` write into a PATCH.
 *
 * Both tables above are filtered to `ACCOUNT` here, so a `DEVICE` row is
 * declared like any other but never pushed — `pushPreference` simply finds no
 * entry for its key. That is the whole mechanism: scope, not omission, is what
 * keeps a per-device preference off the user record.
 */
export const ACCOUNT_PREFERENCES = [
  ...DOM_PREFERENCES.filter((preference) => preference.scope === PREFERENCE_SCOPE.ACCOUNT).map(
    // `attribute` rides along so the hydrate step can apply an incoming value the
    // same way a local write does. The rest of the row (`options`, `scope`) is of
    // no use outside this file.
    ({ key, storageKey, fallback, isValid, attribute }) => ({
      key,
      storageKey,
      fallback,
      isValid,
      attribute,
    })
  ),
  ...VALUE_PREFERENCES.filter((preference) => preference.scope === PREFERENCE_SCOPE.ACCOUNT),
];

/** The account preferences that show up as an attribute on <html>. */
const ACCOUNT_DOM_PREFERENCES = DOM_PREFERENCES.filter(
  (preference) => preference.scope === PREFERENCE_SCOPE.ACCOUNT
);

const DEFAULT_DOM_PREFERENCES = Object.fromEntries(
  DOM_PREFERENCES.map((preference) => [preference.key, preference.fallback])
);

const readStoredColorTheme = () =>
  readStoredPreference(COLOR_THEME_STORAGE_KEY, DEFAULT_COLOR_THEME, isValidColorTheme);

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
  // Whether a session was already live when this tab loaded, captured before
  // anything can sign in or out. The first-run migration needs it to tell a
  // reload from a fresh sign-in on someone else's browser.
  const sessionAtMountRef = useRef(false);

  useEffect(() => {
    // First paint has already happened — `main.jsx`'s IIFE set `data-theme`
    // synchronously. This reconciles React's copy with the cache and applies
    // the remaining attributes.
    //
    // The account preferences follow the person, so a browser holding no session
    // shows the house defaults rather than whatever the last person to sign in
    // here left behind — the accent, and equally the density and accessibility
    // attributes. Same check and same key as the IIFE for the accent, or the two
    // would disagree and the login screen would repaint on mount.
    const signedIn = hasStoredAccessToken();
    sessionAtMountRef.current = signedIn;

    const storedTheme = signedIn ? readStoredColorTheme() : DEFAULT_COLOR_THEME;
    setColorThemeState(storedTheme);
    colorThemeRef.current = storedTheme;
    applyColorThemeToDom(storedTheme);

    const stored = {};
    DOM_PREFERENCES.forEach((preference) => {
      // A device-scoped row (UI scale) is nobody's secret and is a property of
      // this screen, so it is read either way.
      const trustCache = signedIn || preference.scope === PREFERENCE_SCOPE.DEVICE;
      const value = trustCache
        ? readStoredPreference(preference.storageKey, preference.fallback, preference.isValid)
        : preference.fallback;
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
    writeStoredPreference(COLOR_THEME_STORAGE_KEY, themeId);
  }, []);

  const setPreference = useCallback((key, next) => {
    const preference = DOM_PREFERENCES.find((entry) => entry.key === key);
    if (!preference || !preference.isValid(next)) return;
    setPreferences((current) => ({ ...current, [key]: next }));
    document.documentElement.setAttribute(preference.attribute, next);
    // A device-scoped row is not in `ACCOUNT_PREFERENCES`, so the pusher drops it.
    writeStoredPreference(preference.storageKey, next);
  }, []);

  /**
   * Apply one preference everywhere it shows: React state, the DOM, the cache,
   * and — when this is a value of ours the account has not saved yet — the server.
   *
   * `nextDom` collects the attribute-backed ones so the caller can set state once
   * instead of per row.
   */
  const applyPreference = useCallback(
    (preference, value, { push, nextDom }) => {
      if (preference.key === 'mode') {
        // `next-themes` owns this storage key; going through `setTheme` keeps its
        // state, the `class` on <html> and that key in step. Recording it as the
        // last pushed value is what stops the observer effect below from echoing
        // it straight back.
        lastPushedModeRef.current = value;
        setTheme(value);
        if (push) pushPreference(MODE_STORAGE_KEY, value);
        return;
      }

      if (preference.key === 'colorTheme' && colorThemeRef.current !== value) {
        colorThemeRef.current = value;
        setColorThemeState(value);
        applyColorThemeToDom(value);
      }

      if (preference.attribute) {
        document.documentElement.setAttribute(preference.attribute, value);
        nextDom[preference.key] = value;
      }

      cacheStoredPreference(preference.storageKey, value);
      if (push) pushPreference(preference.storageKey, value);
    },
    [setTheme]
  );

  /**
   * Reconcile the cache against the user record, once, after sign-in or after a
   * reload with a live session. Called by `components/UserPreferencesSync.jsx`,
   * which is the only thing in the tree that can see both the auth state and the
   * query client.
   *
   * Per key, not per account. For every account preference:
   *
   * - the account has saved it → the record wins, and the cache is corrected.
   * - it has not, and this cache is ours → keep what this browser had, apply it,
   *   and send it up as the account's first value for that key. This is the
   *   one-time migration off browser-only preferences, and it runs key by key, so
   *   saving one preference on a phone does not reset the others on a laptop.
   * - it has not, and the cache is somebody else's → fall back to the default and
   *   overwrite the leftover, so a shared browser never shows or uploads the
   *   previous person's settings.
   *
   * @param {object|null} serverPreferences the merged preferences document
   * @param {{ storedKeys?: string[], userId?: string|null }} meta `storedKeys` is
   *   the list of preferences this account has actually saved; `userId` decides
   *   whether the cache may be adopted
   */
  const hydrateFromServer = useCallback(
    (serverPreferences, { storedKeys = [], userId = null } = {}) => {
      if (!serverPreferences) return;
      hydratedRef.current = true;

      const savedOnAccount = new Set(storedKeys);
      const cacheIsOurs = preferenceCacheIsOwnedBy(userId, sessionAtMountRef.current);
      const nextDom = {};

      ACCOUNT_PREFERENCES.forEach((preference) => {
        if (savedOnAccount.has(preference.key)) {
          const value = serverValueFor(preference, serverPreferences);
          if (value === undefined) return;
          applyPreference(preference, value, { push: false, nextDom });
          return;
        }

        const cached = readStoredPreference(
          preference.storageKey,
          preference.fallback,
          preference.isValid
        );
        if (cached === preference.fallback) {
          // Nothing to migrate and nothing to clean up — the cache already reads
          // as the default. Still worth remembering for `mode`, whose writes this
          // provider only observes.
          if (preference.key === 'mode') lastPushedModeRef.current = cached;
          return;
        }

        applyPreference(preference, cacheIsOurs ? cached : preference.fallback, {
          push: cacheIsOurs,
          nextDom,
        });
      });

      if (Object.keys(nextDom).length > 0) {
        setPreferences((current) => ({ ...current, ...nextDom }));
      }

      // From here on the cache is unambiguously this account's, whichever branch
      // each key took.
      writePreferenceCacheOwner(userId);
    },
    [applyPreference]
  );

  /**
   * The preferences call failed and is not coming back this session.
   *
   * Everything already works — the cache is what the UI is running on. The one
   * thing that would silently break is light/dark, which is the only preference
   * this provider observes rather than writes, and which stays gated until
   * hydration to avoid echoing the cached value back on the first render. So the
   * gate opens here too, with the cached mode recorded as the baseline: a genuine
   * change from now on still saves.
   */
  const markSyncUnavailable = useCallback(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    lastPushedModeRef.current = readStoredPreference(MODE_STORAGE_KEY, 'system', isValidMode);
  }, []);

  /**
   * Back to the house appearance. The auth screens must never wear the previous
   * user's accent, density or accessibility settings — on a shared browser that is
   * one person's choices leaking onto the next person's login screen.
   *
   * The cache is left alone on purpose: it is still the right answer for the
   * moment that user signs back in, and re-reading it is what makes their reload
   * flash-free.
   */
  const resetToDefaultAppearance = useCallback(() => {
    hydratedRef.current = false;
    lastPushedModeRef.current = null;

    if (colorThemeRef.current !== DEFAULT_COLOR_THEME) {
      colorThemeRef.current = DEFAULT_COLOR_THEME;
      setColorThemeState(DEFAULT_COLOR_THEME);
      applyColorThemeToDom(DEFAULT_COLOR_THEME);
    }

    ACCOUNT_DOM_PREFERENCES.forEach((preference) => {
      document.documentElement.setAttribute(preference.attribute, preference.fallback);
    });
    setPreferences((current) => {
      const reset = ACCOUNT_DOM_PREFERENCES.filter(
        (preference) => current[preference.key] !== preference.fallback
      );
      if (reset.length === 0) return current;
      return {
        ...current,
        ...Object.fromEntries(reset.map((preference) => [preference.key, preference.fallback])),
      };
    });
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
      markSyncUnavailable,
      resetToDefaultAppearance,
    }),
    [
      colorTheme,
      setColorTheme,
      preferences,
      setPreference,
      ready,
      hydrateFromServer,
      markSyncUnavailable,
      resetToDefaultAppearance,
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
