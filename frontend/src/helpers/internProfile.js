export const INTERN_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'ready', label: 'Ready' },
  { value: 'placed', label: 'Placed' },
  { value: 'completed', label: 'Completed' },
  { value: 'discontinued', label: 'Discontinued' },
];

export const READINESS_LEVELS = [
  { value: 'none', label: 'Not started' },
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
