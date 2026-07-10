export const INTERN_STATUSES = [
  { value: 'active', label: 'Learning' },
  { value: 'ready', label: 'Recommended' },
  { value: 'placed', label: 'Placed' },
  { value: 'completed', label: 'Completed' },
  { value: 'discontinued', label: 'Discontinued' },
];

export const READINESS_LEVELS = [
  { value: 'none', label: 'Not assessed' },
  { value: 'learning', label: 'Learning' },
  { value: 'ready', label: 'Ready' },
];

export const EVALUATION_CRITERIA = [
  { key: 'technical', label: 'Technical' },
  { key: 'communication', label: 'Communication' },
  { key: 'ownership', label: 'Ownership' },
  { key: 'growth', label: 'Growth' },
];

export const getInternStatusLabel = (status) =>
  INTERN_STATUSES.find((s) => s.value === status)?.label ?? status;

export const getReadinessLabel = (level) =>
  READINESS_LEVELS.find((r) => r.value === level)?.label ?? level;

export const getReadinessBadgeClassName = (level) => {
  switch (level) {
    case 'ready':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';
    case 'learning':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300';
    default:
      return 'border-border/60 bg-muted/30 text-muted-foreground';
  }
};
