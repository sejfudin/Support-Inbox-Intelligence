/** Theme-aware class strings for badges, pills, chips, and indicators */

const tone = (base) => ({
  badge: `${base.badge} hover:opacity-90`,
  indicator: base.indicator,
  chip: base.chip || base.badge,
});

export const BADGE_TONES = {
  success: tone({
    badge:
      'bg-emerald-500/15 text-emerald-800 border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/35',
    indicator:
      'bg-emerald-500/10 text-emerald-800 border-emerald-500/25 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
  }),
  info: tone({
    badge:
      'bg-blue-500/15 text-blue-800 border-blue-500/30 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/35',
    indicator:
      'bg-blue-500/10 text-blue-800 border-blue-500/25 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30',
  }),
  warning: tone({
    badge:
      'bg-amber-500/15 text-amber-800 border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/35',
    indicator:
      'bg-amber-500/10 text-amber-800 border-amber-500/25 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
  }),
  danger: tone({
    badge:
      'bg-red-500/15 text-red-800 border-red-500/30 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/35',
    indicator:
      'bg-red-500/10 text-red-800 border-red-500/25 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30',
  }),
  orange: tone({
    badge:
      'bg-orange-500/15 text-orange-800 border-orange-500/30 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-500/35',
    indicator:
      'bg-orange-500/10 text-orange-800 border-orange-500/25 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30',
  }),
  cyan: tone({
    badge:
      'bg-cyan-500/15 text-cyan-800 border-cyan-500/30 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/35',
    indicator:
      'bg-cyan-500/10 text-cyan-800 border-cyan-500/25 dark:bg-cyan-500/15 dark:text-cyan-300 dark:border-cyan-500/30',
  }),
  violet: tone({
    badge:
      'bg-violet-500/15 text-violet-800 border-violet-500/30 dark:bg-violet-500/20 dark:text-violet-300 dark:border-violet-500/35',
    indicator:
      'bg-violet-500/10 text-violet-800 border-violet-500/25 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30',
  }),
  indigo: tone({
    badge:
      'bg-indigo-500/15 text-indigo-800 border-indigo-500/30 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/35',
    indicator:
      'bg-indigo-500/10 text-indigo-800 border-indigo-500/25 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/30',
  }),
  neutral: tone({
    badge: 'bg-muted text-muted-foreground border-border hover:bg-muted/80',
    indicator: 'bg-muted/80 text-muted-foreground border-border',
  }),
  primary: tone({
    badge:
      'bg-primary/15 text-primary border-primary/30 dark:bg-primary/20 dark:text-primary dark:border-primary/35',
    indicator:
      'bg-primary/10 text-primary border-primary/25 dark:bg-primary/15 dark:text-primary dark:border-primary/30',
  }),
};

export const DOT_TONES = {
  success: 'bg-emerald-500 dark:bg-emerald-400',
  info: 'bg-blue-500 dark:bg-blue-400',
  warning: 'bg-amber-500 dark:bg-amber-400',
  danger: 'bg-red-500 dark:bg-red-400',
  orange: 'bg-orange-500 dark:bg-orange-400',
  cyan: 'bg-cyan-500 dark:bg-cyan-400',
  violet: 'bg-violet-500 dark:bg-violet-400',
  neutral: 'bg-muted-foreground',
};

export const badgeTone = (key) => BADGE_TONES[key]?.badge ?? BADGE_TONES.neutral.badge;
export const indicatorTone = (key) => BADGE_TONES[key]?.indicator ?? BADGE_TONES.neutral.indicator;
export const chipTone = (key) => BADGE_TONES[key]?.chip ?? BADGE_TONES.neutral.chip;
export const dotTone = (key) => DOT_TONES[key] ?? DOT_TONES.neutral;
