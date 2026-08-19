export const COLOR_THEME_STORAGE_KEY = 'color-theme';

export const DEFAULT_COLOR_THEME = 'default';

/**
 * The accent palettes. Every `id` matches a `[data-theme='…']` block in
 * `styles/themes.css` — adding one here without the CSS gives a swatch that
 * changes nothing. The ids are storage values and never change; only the labels
 * are for reading. Dropping one is safe: `isValidColorTheme` sends anyone still
 * holding a retired id back to the default.
 *
 * Eleven, because the picker is a decision and not a catalogue: two blues sitting
 * next to each other cost the reader a comparison and buy nothing. Nine carry a
 * hue and are spread around the wheel so no two are mistakable for each other;
 * the last two are deliberate neutrals — Forged Ash warm, Black & White absolute.
 * Most hued accents are stock Tailwind steps (indigo-500, violet-600,
 * fuchsia-600, sky-500, emerald-600, orange-500), so a colour picked here is the
 * same colour a designer means by its name. Ruby and Coral are the exception:
 * Tailwind's rose-600 is both of them at once, so they are hand-separated into a
 * dark jewel crimson and a light salmon instead.
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
    label: 'Lavender Purple',
    description: 'Warmer and deeper than Symphony, same cool neutrals',
    preview: {
      gradient: 'linear-gradient(135deg, #C4B5FD, #8B5CF6 55%, #6D28D9)',
      primary: 'hsl(262 83% 58%)',
      background: 'hsl(210 20% 98%)',
    },
  },
  {
    id: 'magenta',
    label: 'Orchid Pink',
    description: 'Pink-purple with more punch than Lavender',
    preview: {
      gradient: 'linear-gradient(135deg, #F0ABFC, #D946EF 55%, #A21CAF)',
      primary: 'hsl(293 69% 49%)',
      background: 'hsl(210 20% 98%)',
    },
  },
  {
    id: 'ruby',
    label: 'Ruby Red',
    description: 'Deep jewel crimson — darker and cooler than Coral',
    preview: {
      gradient: 'linear-gradient(135deg, #F4869E, #B21138 55%, #61091F)',
      primary: 'hsl(346 84% 38%)',
      background: 'hsl(210 20% 98%)',
    },
  },
  {
    id: 'rose',
    label: 'Coral Pink',
    description: 'Warm salmon — the soft end of the red band',
    preview: {
      gradient: 'linear-gradient(135deg, #FCA5A0, #EA5A45 55%, #A3301F)',
      primary: 'hsl(6 80% 57%)',
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
    id: 'teal',
    label: 'Pacific Teal',
    description: 'Blue-green for reduced eye strain over a long day',
    preview: {
      gradient: 'linear-gradient(135deg, #5EEAD4, #0D9488 55%, #115E59)',
      primary: 'hsl(174 82% 28%)',
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
    id: 'midnight',
    label: 'Midnight Navy',
    description: 'Near-ink blue — the quiet, serious end of the house hue',
    preview: {
      gradient: 'linear-gradient(135deg, #8FA8CE, #22314F 55%, #0F1729)',
      primary: 'hsl(222 47% 26%)',
      background: 'hsl(210 20% 98%)',
    },
  },
  {
    id: 'ash',
    label: 'Forged Ash',
    description: 'Warm charcoal and cooled metal — at its best in dark mode',
    preview: {
      gradient: 'linear-gradient(135deg, #A89283, #5B4A44 55%, #2A2123)',
      primary: 'hsl(14 18% 25%)',
      background: 'hsl(24 22% 97%)',
    },
  },
  {
    id: 'mono',
    label: 'Black & White',
    description: 'No hue anywhere — the highest contrast on offer',
    preview: {
      gradient: 'linear-gradient(135deg, #FFFFFF, #A3A3A3 55%, #000000)',
      primary: 'hsl(0 0% 0%)',
      background: 'hsl(0 0% 100%)',
    },
  },
];

export const isValidColorTheme = (id) => THEMES.some((theme) => theme.id === id);
