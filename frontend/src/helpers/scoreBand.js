// Single source of truth for the 1–5 score color bands used across the intern
// evaluation UI (ring, bars, banner, tiles). Keeping one threshold set here
// prevents a value like 4.0 reading "green" in one place and "amber" in another.
//
// Bands: high ≥ 4.5 (emerald), mid ≥ 3.5 (primary/indigo), low < 3.5 (amber).
export const scoreBand = (value) => {
  if (value >= 4.5) return 'high';
  if (value >= 3.5) return 'mid';
  return 'low';
};

// Tailwind text color per band (fill/number). Includes dark-mode variants.
export const scoreTextClass = (value) =>
  ({
    high: 'text-emerald-600 dark:text-emerald-400',
    mid: 'text-primary',
    low: 'text-amber-600 dark:text-amber-500',
  })[scoreBand(value)];

// Tailwind background fill per band (progress bars).
export const scoreFillClass = (value) =>
  ({ high: 'bg-emerald-500', mid: 'bg-primary', low: 'bg-amber-500' })[scoreBand(value)];

// Tailwind faint background per band (bar tracks, banner backgrounds).
export const scoreTrackClass = (value) =>
  ({ high: 'bg-emerald-500/15', mid: 'bg-primary/15', low: 'bg-amber-500/15' })[scoreBand(value)];

// Raw HSL for inline styles (the conic-gradient ring can't use Tailwind classes).
export const scoreFillHsl = (value) =>
  ({ high: 'hsl(160 84% 39%)', mid: 'hsl(var(--primary))', low: 'hsl(38 92% 50%)' })[
    scoreBand(value)
  ];

export const scoreTrackHsl = (value) =>
  ({
    high: 'hsl(160 84% 39% / 0.16)',
    mid: 'hsl(var(--primary) / 0.16)',
    low: 'hsl(38 92% 50% / 0.16)',
  })[scoreBand(value)];
