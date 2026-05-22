import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ThemeProvider } from 'next-themes';

import { ThemeConfigProvider } from './context/ThemeConfigContext';
import { queryClient } from './lib/queryClient';
import { COLOR_THEME_STORAGE_KEY, DEFAULT_COLOR_THEME, isValidColorTheme } from './lib/themes';
import './index.css';
import App from './App.jsx';

(function initColorTheme() {
  try {
    const stored = localStorage.getItem(COLOR_THEME_STORAGE_KEY);
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
