/**
 * Theme-aware class strings for badges, pills, chips, and indicators.
 *
 * Every colour here resolves through a `--tone-*` custom property rather than a
 * literal Tailwind class (`bg-emerald-500/15`). The default values of those
 * tokens ARE the Tailwind steps this file used to name, so nothing looks
 * different — but Settings → Accessibility → Colour-blind safe can now repaint
 * the whole status vocabulary by redefining eight variables in `index.css`,
 * instead of us hunting utility strings through forty components.
 *
 * Only the ink flips between light and dark; the base hue stays put, which is
 * why there is one `--tone-x` and one `--tone-x-fg` rather than a pair per mode.
 *
 * Every class below is written out in full. It is repetitive on purpose:
 * Tailwind's JIT finds classes by scanning source text, so a name assembled at
 * runtime (`bg-[hsl(var(--tone-${key})/0.15)]`) generates no CSS at all and the
 * chips render unstyled. Do not refactor these strings into a template.
 */

const withChip = (base) => ({ ...base, chip: base.chip || base.badge });

export const BADGE_TONES = {
  success: withChip({
    badge:
      'bg-[hsl(var(--tone-success)/0.15)] text-[hsl(var(--tone-success-fg))] border-[hsl(var(--tone-success)/0.3)] dark:bg-[hsl(var(--tone-success)/0.2)] dark:border-[hsl(var(--tone-success)/0.35)] hover:opacity-90',
    indicator:
      'bg-[hsl(var(--tone-success)/0.1)] text-[hsl(var(--tone-success-fg))] border-[hsl(var(--tone-success)/0.25)] dark:bg-[hsl(var(--tone-success)/0.15)] dark:border-[hsl(var(--tone-success)/0.3)]',
  }),
  info: withChip({
    badge:
      'bg-[hsl(var(--tone-info)/0.15)] text-[hsl(var(--tone-info-fg))] border-[hsl(var(--tone-info)/0.3)] dark:bg-[hsl(var(--tone-info)/0.2)] dark:border-[hsl(var(--tone-info)/0.35)] hover:opacity-90',
    indicator:
      'bg-[hsl(var(--tone-info)/0.1)] text-[hsl(var(--tone-info-fg))] border-[hsl(var(--tone-info)/0.25)] dark:bg-[hsl(var(--tone-info)/0.15)] dark:border-[hsl(var(--tone-info)/0.3)]',
  }),
  warning: withChip({
    badge:
      'bg-[hsl(var(--tone-warning)/0.15)] text-[hsl(var(--tone-warning-fg))] border-[hsl(var(--tone-warning)/0.3)] dark:bg-[hsl(var(--tone-warning)/0.2)] dark:border-[hsl(var(--tone-warning)/0.35)] hover:opacity-90',
    indicator:
      'bg-[hsl(var(--tone-warning)/0.1)] text-[hsl(var(--tone-warning-fg))] border-[hsl(var(--tone-warning)/0.25)] dark:bg-[hsl(var(--tone-warning)/0.15)] dark:border-[hsl(var(--tone-warning)/0.3)]',
  }),
  danger: withChip({
    badge:
      'bg-[hsl(var(--tone-danger)/0.15)] text-[hsl(var(--tone-danger-fg))] border-[hsl(var(--tone-danger)/0.3)] dark:bg-[hsl(var(--tone-danger)/0.2)] dark:border-[hsl(var(--tone-danger)/0.35)] hover:opacity-90',
    indicator:
      'bg-[hsl(var(--tone-danger)/0.1)] text-[hsl(var(--tone-danger-fg))] border-[hsl(var(--tone-danger)/0.25)] dark:bg-[hsl(var(--tone-danger)/0.15)] dark:border-[hsl(var(--tone-danger)/0.3)]',
  }),
  orange: withChip({
    badge:
      'bg-[hsl(var(--tone-orange)/0.15)] text-[hsl(var(--tone-orange-fg))] border-[hsl(var(--tone-orange)/0.3)] dark:bg-[hsl(var(--tone-orange)/0.2)] dark:border-[hsl(var(--tone-orange)/0.35)] hover:opacity-90',
    indicator:
      'bg-[hsl(var(--tone-orange)/0.1)] text-[hsl(var(--tone-orange-fg))] border-[hsl(var(--tone-orange)/0.25)] dark:bg-[hsl(var(--tone-orange)/0.15)] dark:border-[hsl(var(--tone-orange)/0.3)]',
  }),
  cyan: withChip({
    badge:
      'bg-[hsl(var(--tone-cyan)/0.15)] text-[hsl(var(--tone-cyan-fg))] border-[hsl(var(--tone-cyan)/0.3)] dark:bg-[hsl(var(--tone-cyan)/0.2)] dark:border-[hsl(var(--tone-cyan)/0.35)] hover:opacity-90',
    indicator:
      'bg-[hsl(var(--tone-cyan)/0.1)] text-[hsl(var(--tone-cyan-fg))] border-[hsl(var(--tone-cyan)/0.25)] dark:bg-[hsl(var(--tone-cyan)/0.15)] dark:border-[hsl(var(--tone-cyan)/0.3)]',
  }),
  violet: withChip({
    badge:
      'bg-[hsl(var(--tone-violet)/0.15)] text-[hsl(var(--tone-violet-fg))] border-[hsl(var(--tone-violet)/0.3)] dark:bg-[hsl(var(--tone-violet)/0.2)] dark:border-[hsl(var(--tone-violet)/0.35)] hover:opacity-90',
    indicator:
      'bg-[hsl(var(--tone-violet)/0.1)] text-[hsl(var(--tone-violet-fg))] border-[hsl(var(--tone-violet)/0.25)] dark:bg-[hsl(var(--tone-violet)/0.15)] dark:border-[hsl(var(--tone-violet)/0.3)]',
  }),
  indigo: withChip({
    badge:
      'bg-[hsl(var(--tone-indigo)/0.15)] text-[hsl(var(--tone-indigo-fg))] border-[hsl(var(--tone-indigo)/0.3)] dark:bg-[hsl(var(--tone-indigo)/0.2)] dark:border-[hsl(var(--tone-indigo)/0.35)] hover:opacity-90',
    indicator:
      'bg-[hsl(var(--tone-indigo)/0.1)] text-[hsl(var(--tone-indigo-fg))] border-[hsl(var(--tone-indigo)/0.25)] dark:bg-[hsl(var(--tone-indigo)/0.15)] dark:border-[hsl(var(--tone-indigo)/0.3)]',
  }),
  // Neutral and primary already run on theme tokens, so they follow the palette
  // rather than the tone set and need no colour-blind treatment.
  neutral: withChip({
    badge: 'bg-muted text-muted-foreground border-border hover:bg-muted/80',
    indicator: 'bg-muted/80 text-muted-foreground border-border',
  }),
  primary: withChip({
    badge:
      'bg-primary/15 text-primary border-primary/30 dark:bg-primary/20 dark:text-primary dark:border-primary/35',
    indicator:
      'bg-primary/10 text-primary border-primary/25 dark:bg-primary/15 dark:text-primary dark:border-primary/30',
  }),
};

export const DOT_TONES = {
  success: 'bg-[hsl(var(--tone-success))]',
  info: 'bg-[hsl(var(--tone-info))]',
  warning: 'bg-[hsl(var(--tone-warning))]',
  danger: 'bg-[hsl(var(--tone-danger))]',
  orange: 'bg-[hsl(var(--tone-orange))]',
  cyan: 'bg-[hsl(var(--tone-cyan))]',
  violet: 'bg-[hsl(var(--tone-violet))]',
  neutral: 'bg-muted-foreground',
};

/**
 * The chip geometry, for the handful of badges that cannot go through
 * `components/ui/badge` because their colour is data — a workspace's own status
 * colour, stored as a hex on the status record. Pair with `badgeTone(...)` when
 * the colour *is* one of ours.
 *
 * Identical to `Badge`'s base by construction: radius 6 (`--r-badge`), 10.5px/600,
 * padding 3px 9px, no border, sentence case. If one of them changes, change both
 * — a chip a pixel off the badge beside it is exactly what this file exists to
 * prevent.
 *
 * It used to be the opt-in half of a pair, selected by a `flat` prop, with an
 * uppercase bordered pill as the default. There is one look now; the prop is
 * gone from every badge component.
 */
export const CHIP =
  'inline-flex items-center whitespace-nowrap rounded-[var(--r-badge)] px-[9px] py-[3px] text-[10.5px] font-semibold leading-[1.5]';

export const badgeTone = (key) => BADGE_TONES[key]?.badge ?? BADGE_TONES.neutral.badge;
export const indicatorTone = (key) => BADGE_TONES[key]?.indicator ?? BADGE_TONES.neutral.indicator;
export const chipTone = (key) => BADGE_TONES[key]?.chip ?? BADGE_TONES.neutral.chip;
export const dotTone = (key) => DOT_TONES[key] ?? DOT_TONES.neutral;
