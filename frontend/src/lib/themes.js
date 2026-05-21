export const COLOR_THEME_STORAGE_KEY = 'color-theme';

export const DEFAULT_COLOR_THEME = 'default';

export const THEMES = [
  {
    id: 'default',
    label: 'Indigo',
    description: 'Original brand palette with violet accents',
    preview: { primary: 'hsl(241 100% 71%)', background: 'hsl(240 43% 98%)' },
  },
  {
    id: 'slate',
    label: 'Slate',
    description: 'Neutral professional tones for focused work',
    preview: { primary: 'hsl(215 20% 45%)', background: 'hsl(210 20% 98%)' },
  },
  {
    id: 'ocean',
    label: 'Ocean',
    description: 'Cool blues and cyans for a calm inbox',
    preview: { primary: 'hsl(199 89% 48%)', background: 'hsl(204 45% 97%)' },
  },
  {
    id: 'forest',
    label: 'Forest',
    description: 'Emerald greens for reduced eye strain',
    preview: { primary: 'hsl(152 69% 40%)', background: 'hsl(150 30% 97%)' },
  },
  {
    id: 'sunset',
    label: 'Sunset',
    description: 'Warm amber and rose for friendly support',
    preview: { primary: 'hsl(24 95% 53%)', background: 'hsl(30 40% 97%)' },
  },
  {
    id: 'mono',
    label: 'Mono',
    description: 'High-contrast grayscale for accessibility',
    preview: { primary: 'hsl(0 0% 25%)', background: 'hsl(0 0% 98%)' },
  },
];

export const isValidColorTheme = (id) => THEMES.some((theme) => theme.id === id);
