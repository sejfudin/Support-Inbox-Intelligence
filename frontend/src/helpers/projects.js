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

// Starting pair only — the full list is still being settled with the program
// leads. The stored values are the server's enum slugs (server/models/Project.js
// PROJECT_TYPES); these labels are display-only, so renaming what the team calls
// a type never touches the database.
export const PROJECT_TYPES = [
  { value: 'client', label: 'Client' },
  { value: 'internal', label: 'Internal' },
];

export const getProjectTypeLabel = (type) =>
  PROJECT_TYPES.find((option) => option.value === type)?.label ?? type;

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

// Shared with BreakdownDonut/TechnologySupply's palette family — ranking
// bars in different shades instead of one flat color. Used by both the
// "Skills in selection" KPI card and its modal so the two never drift.
export const SKILL_BAR_PALETTE = ['#6C63FF', '#2FA98C', '#DA7328', '#4F86E8', '#E0568A', '#3FB1C8'];

// "Recommended" vs "interviewing" color identity, shared by the In-selection
// modal and the project detail page so the two always agree.
export const SELECTION_STAGE_THEME = {
  recommended: {
    panel: 'border-[hsl(var(--symphony-brand)/0.2)] bg-[hsl(var(--symphony-brand)/0.05)]',
    dot: 'bg-[hsl(var(--symphony-brand))]',
    avatar:
      'bg-[hsl(var(--symphony-brand)/0.15)] text-[hsl(var(--symphony-brand-strong))] dark:text-[hsl(var(--symphony-brand))]',
    badge: 'default',
  },
  interviewing: {
    panel: 'border-amber-500/25 bg-amber-500/[0.05]',
    dot: 'bg-amber-500',
    avatar: 'bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
    badge: 'warning',
  },
};

export const getSelectionStageTheme = (stage) =>
  SELECTION_STAGE_THEME[stage] ?? SELECTION_STAGE_THEME.recommended;
