export const COLOR_THEME_STORAGE_KEY = 'color-theme';

export const DEFAULT_COLOR_THEME = 'default';

/**
 * The accent palettes. Every `id` matches a `[data-theme='…']` block in
 * `styles/themes.css` — adding one here without the CSS gives a swatch that
 * changes nothing. The ids are storage values and never change; only the labels
 * are for reading.
 *
 * Eight, one per hue family, because the picker is a decision and not a
 * catalogue: two blues sitting next to each other cost the reader a comparison
 * and buy nothing. The accents themselves are stock Tailwind steps (indigo-500,
 * violet-600, sky-500, emerald-600, orange-500, rose-600), so a colour picked
 * here is the same colour a designer means by its name.
 *
 * `preview.primary` and `preview.background` are what the sidebar's Appearance
 * grid paints; `preview.gradient` is the Settings swatch.
 */
export const THEMES = [
  {
    id: 'default',
    label: 'Symphony Indigo',
    description: 'The house palette — indigo on a cool white page',
    preview: {
      gradient: 'linear-gradient(135deg, #A5B4FC, #6366F1 55%, #4338CA)',
      primary: 'hsl(239 84% 67%)',
      background: 'hsl(240 43% 98%)',
    },
  },
  {
    id: 'violet',
    label: 'Deep Purple',
    description: 'Warmer and deeper than Symphony, same cool neutrals',
    preview: {
      gradient: 'linear-gradient(135deg, #C4B5FD, #8B5CF6 55%, #6D28D9)',
      primary: 'hsl(262 83% 58%)',
      background: 'hsl(210 20% 98%)',
    },
  },
  {
    id: 'magenta',
    label: 'Orchid Magenta',
    description: 'Pink-purple with more punch than Deep Purple',
    preview: {
      gradient: 'linear-gradient(135deg, #F0ABFC, #D946EF 55%, #A21CAF)',
      primary: 'hsl(293 69% 49%)',
      background: 'hsl(210 20% 98%)',
    },
  },
  {
    id: 'azure',
    label: 'Azure Blue',
    description: 'The workhorse product blue — high trust, low drama',
    preview: {
      gradient: 'linear-gradient(135deg, #93C5FD, #3B82F6 55%, #1D4ED8)',
      primary: 'hsl(221 83% 53%)',
      background: 'hsl(210 20% 98%)',
    },
  },
  {
    id: 'ocean',
    label: 'Ocean Blue',
    description: 'Cool blues and cyans for a calm inbox',
    preview: {
      gradient: 'linear-gradient(135deg, #7DD3FC, #0EA5E9 55%, #0369A1)',
      primary: 'hsl(199 89% 48%)',
      background: 'hsl(204 45% 97%)',
    },
  },
  {
    id: 'teal',
    label: 'Pacific Teal',
    description: 'Blue-green — quieter than Alpine, cooler than Ocean',
    preview: {
      gradient: 'linear-gradient(135deg, #5EEAD4, #14B8A6 55%, #0F766E)',
      primary: 'hsl(173 80% 40%)',
      background: 'hsl(210 20% 98%)',
    },
  },
  {
    id: 'forest',
    label: 'Alpine Green',
    description: 'Greens for reduced eye strain over a long day',
    preview: {
      gradient: 'linear-gradient(135deg, #6EE7B7, #10B981 55%, #047857)',
      primary: 'hsl(152 69% 40%)',
      background: 'hsl(150 30% 97%)',
    },
  },
  {
    id: 'amber',
    label: 'Desert Gold',
    description: 'Yellow-amber — the warmest accent that still reads on white',
    preview: {
      gradient: 'linear-gradient(135deg, #FCD34D, #F59E0B 55%, #B45309)',
      primary: 'hsl(38 92% 50%)',
      background: 'hsl(210 20% 98%)',
    },
  },
  {
    id: 'sunset',
    label: 'Sunset Orange',
    description: 'Warm amber for a friendlier support surface',
    preview: {
      gradient: 'linear-gradient(135deg, #FDBA74, #F97316 55%, #C2410C)',
      primary: 'hsl(24 95% 53%)',
      background: 'hsl(30 40% 97%)',
    },
  },
  {
    id: 'rose',
    label: 'Coral Pink',
    description: 'Red-pink with enough weight to carry buttons',
    preview: {
      gradient: 'linear-gradient(135deg, #FDA4AF, #F43F5E 55%, #BE123C)',
      primary: 'hsl(347 77% 50%)',
      background: 'hsl(210 20% 98%)',
    },
  },
  {
    id: 'slate',
    label: 'Graphite',
    description: 'Neutral professional tones for focused work',
    preview: {
      gradient: 'linear-gradient(135deg, #CBD5E1, #64748B 55%, #334155)',
      primary: 'hsl(215 25% 35%)',
      background: 'hsl(210 20% 98%)',
    },
  },
  {
    id: 'mono',
    label: 'Space Black',
    description: 'High-contrast grayscale for accessibility',
    preview: {
      gradient: 'linear-gradient(135deg, #A1A1AA, #52525B 55%, #18181B)',
      primary: 'hsl(0 0% 25%)',
      background: 'hsl(0 0% 98%)',
    },
  },
];

export const isValidColorTheme = (id) => THEMES.some((theme) => theme.id === id);
