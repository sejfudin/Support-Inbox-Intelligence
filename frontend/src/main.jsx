import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ThemeProvider } from 'next-themes';

import { ThemeConfigProvider } from './context/ThemeConfigContext';
import { queryClient } from './lib/queryClient';
import { hasStoredAccessToken } from './lib/authStorage';
import { COLOR_THEME_STORAGE_KEY, DEFAULT_COLOR_THEME, isValidColorTheme } from './lib/themes';
import './index.css';
import App from './App.jsx';

/**
 * The accent, on <html>, before React mounts and before the first paint.
 *
 * It has to be synchronous: the palette is an account preference now, but a
 * server round trip cannot beat the first paint, so `localStorage` is a
 * write-through cache read here and reconciled against the user record after
 * mount (`components/UserPreferencesSync.jsx`).
 *
 * The cache is only trusted when there is a session. On a shared browser the
 * cached accent belongs to whoever signed in last, and the login, set-password
 * and register screens must not wear it — so with no access token this paints
 * the house palette and lets sign-in bring the right one back.
 */
(function initColorTheme() {
  try {
    const stored = hasStoredAccessToken() ? localStorage.getItem(COLOR_THEME_STORAGE_KEY) : null;
    const themeId = stored && isValidColorTheme(stored) ? stored : DEFAULT_COLOR_THEME;
    document.documentElement.setAttribute('data-theme', themeId);
  } catch {
    document.documentElement.setAttribute('data-theme', DEFAULT_COLOR_THEME);
  }
})();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="theme"
      disableTransitionOnChange={false}
    >
      <ThemeConfigProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
          <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
      </ThemeConfigProvider>
    </ThemeProvider>
  </StrictMode>
);
