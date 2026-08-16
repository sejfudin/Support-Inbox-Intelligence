// Single source of truth for the 1–5 score color bands used across the intern
// evaluation UI (ring, bars, banner, tiles). Keeping one threshold set here
// prevents a value like 4.0 reading "green" in one place and "amber" in another.
//
// Bands: high ≥ 4 (emerald), mid ≥ 3 (primary/info), low < 3 (amber).
//
// The thresholds sit on the whole numbers a mentor actually enters — the scale is
// 1–5 in steps of 1, so a band edge at 4.5 or 3.5 could never be hit by a single
// criterion and every 4 read as "low". A 4 is good, a 3 is the middle of the
// scale, and below 3 is the thing worth flagging.
export const scoreBand = (value) => {
  if (value >= 4) return 'high';
  if (value >= 3) return 'mid';
  return 'low';
};

// Tailwind text color per band (fill/number). Includes dark-mode variants.
export const scoreTextClass = (value) =>
  ({
    high: 'text-[hsl(var(--tone-success-fg))]',
    mid: 'text-primary',
    low: 'text-[hsl(var(--tone-warning-fg))] dark:text-[hsl(var(--tone-warning))]',
  })[scoreBand(value)];

// Tailwind background fill per band (progress bars).
export const scoreFillClass = (value) =>
  ({
    high: 'bg-[hsl(var(--tone-success))]',
    mid: 'bg-primary',
    low: 'bg-[hsl(var(--tone-warning))]',
  })[scoreBand(value)];

// Tailwind faint background per band (bar tracks, banner backgrounds).
export const scoreTrackClass = (value) =>
  ({
    high: 'bg-[hsl(var(--tone-success)/0.15)]',
    mid: 'bg-primary/15',
    low: 'bg-[hsl(var(--tone-warning)/0.15)]',
  })[scoreBand(value)];

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
