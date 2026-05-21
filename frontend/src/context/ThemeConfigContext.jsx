import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useTheme } from 'next-themes';

import { flashThemeTransition } from '@/lib/themeTransition';
import {
  COLOR_THEME_STORAGE_KEY,
  DEFAULT_COLOR_THEME,
  THEMES,
  isValidColorTheme,
} from '@/lib/themes';

const ThemeConfigContext = createContext(null);

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

export function ThemeConfigProvider({ children }) {
  const { resolvedTheme } = useTheme();
  const [colorTheme, setColorThemeState] = useState(DEFAULT_COLOR_THEME);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = readStoredColorTheme();
    setColorThemeState(stored);
    applyColorThemeToDom(stored);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!resolvedTheme) return;
    document.documentElement.style.colorScheme = resolvedTheme === 'dark' ? 'dark' : 'light';
  }, [resolvedTheme]);

  const setColorTheme = useCallback((themeId) => {
    if (!isValidColorTheme(themeId)) return;
    flashThemeTransition();
    setColorThemeState(themeId);
    applyColorThemeToDom(themeId);
    try {
      localStorage.setItem(COLOR_THEME_STORAGE_KEY, themeId);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({
      colorTheme,
      setColorTheme,
      themes: THEMES,
      ready,
      flashThemeTransition,
    }),
    [colorTheme, setColorTheme, ready]
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
