import {
  getRecommendationResultLabel,
  getRecommendationStatusLabel,
} from '@/helpers/recommendations';

export const PROJECT_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'completed', label: 'Completed' },
];

export const getProjectStatusLabel = (status) =>
  PROJECT_STATUSES.find((option) => option.value === status)?.label ?? status;

// In-selection stage vocabulary is the same one recommendations already use
// (Recommended / Interviewing) — reused rather than duplicated.
export const getSelectionStageLabel = (stage) => getRecommendationStatusLabel(stage);

export const getOutcomeLabel = (outcome) => getRecommendationResultLabel(outcome);

// The admin recommendations table renders "Not placed" as a destructive/red
// badge — a real warning signal for that audience. On the project Outcome
// history section it isn't a negative signal about the intern (a project can
// simply pause), so it reads neutral instead — deliberately not reusing
// getRecommendationResultVariant, which is tuned for the admin table.
export const getOutcomeHistoryTone = (outcome) =>
  outcome === 'placed'
    ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
    : 'border-border bg-muted/40 text-muted-foreground';
