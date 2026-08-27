// Lifecycle statuses are shown exactly as stored in the database — no label
// mapping. `ready` means the intern is ready for placement.
export const READY_STATUS = 'ready';
export const INTERN_STATUSES = ['active', 'ready', 'placed', 'completed', 'discontinued'];

// Pseudo-stage for the candidates placement-stage filter: not a lifecycle
// status — matches interns with an active recommendation (recommended or
// interviewing) via the `inPipeline` list query param.
export const IN_PIPELINE_STAGE = 'in-pipeline';

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

// The day-one value of every flag: not a verdict, but the absence of one.
export const UNASSESSED_LEVEL = 'none';

/**
 * Whether a mentor has actually recorded a level for something.
 *
 * Lives here with the vocabulary so nothing has to spell out `=== 'learning' ||
 * === 'ready'` and forget one of them — or forget to widen the test when a fourth
 * level appears. Anything that is not the unassessed default counts as assessed,
 * which is the safe default for a new level.
 */
export const isAssessedLevel = (level) => Boolean(level) && level !== UNASSESSED_LEVEL;

export const getReadinessLabel = (level) =>
  READINESS_LEVELS.find((r) => r.value === level)?.label ?? level;

export const getReadinessBadgeClassName = (level) => {
  switch (level) {
    case 'ready':
      return 'border-[hsl(var(--tone-success)/0.3)] bg-[hsl(var(--tone-success)/0.1)] text-[hsl(var(--tone-success-fg))]';
    case 'learning':
      return 'border-[hsl(var(--tone-warning)/0.3)] bg-[hsl(var(--tone-warning)/0.1)] text-[hsl(var(--tone-warning-fg))]';
    default:
      return 'border-border/60 bg-muted/30 text-muted-foreground';
  }
};

// Which specialization control an admin gets on an intern's profile. A profile
// shows one intern, so the tab's four verbs collapse to one: the marker decides
// whether there is a specialization to maintain or one to create, and a missing
// `declaredPosition` is what makes the create case impossible — `POST
// /api/specializations` rejects it, so the profile refuses before the dialog.
export const SPECIALIZATION_ACTIONS = {
  ASSIGN: 'assign',
  CHANGE_MENTOR: 'change-mentor',
  BLOCKED: 'blocked',
};

// `specializationAssignedAt` is the whole marker — set means `declaredPosition`
// IS the specialization, with no separate field (ADR 0002). Asking the record
// directly, rather than inferring it back out of which action was offered.
export const isSpecialized = (intern) => Boolean(intern?.specializationAssignedAt);

export const getSpecializationAction = (intern) => {
  if (isSpecialized(intern)) return SPECIALIZATION_ACTIONS.CHANGE_MENTOR;
  return intern?.declaredPosition ? SPECIALIZATION_ACTIONS.ASSIGN : SPECIALIZATION_ACTIONS.BLOCKED;
};
