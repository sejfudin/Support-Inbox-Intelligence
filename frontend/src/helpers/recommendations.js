export const RECOMMENDATION_STATUSES = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'interviewing', label: 'Interviewing' },
  { value: 'resulted', label: 'Resulted' },
];

export const RECOMMENDATION_RESULTS = [
  { value: 'placed', label: 'Placed' },
  { value: 'not_placed', label: 'Not placed' },
];

// Open pipeline stages — an intern can hold several of these across projects.
export const ACTIVE_PIPELINE_STATUSES = ['recommended', 'interviewing'];

// Mirrors server NON_RECOMMENDABLE_PROFILE_STATUSES: create is rejected with 409.
export const NON_RECOMMENDABLE_PROFILE_STATUSES = ['placed', 'completed', 'discontinued'];

export const isActivePipelineRecommendation = (recommendation) =>
  ACTIVE_PIPELINE_STATUSES.includes(recommendation?.status);

export const isRecommendBlockedByProfileStatus = (status) =>
  NON_RECOMMENDABLE_PROFILE_STATUSES.includes(status);

/** Human-readable reason the New recommendation button is disabled. */
export const recommendBlockedReason = (status) => {
  if (status === 'placed') {
    return 'This intern is already placed on a project and cannot be recommended again.';
  }
  if (status === 'completed') {
    return 'This intern has completed the programme and cannot be recommended.';
  }
  if (status === 'discontinued') {
    return 'This intern has left the programme and cannot be recommended.';
  }
  return 'This intern cannot be recommended in their current status.';
};

export const recommendationProjectId = (recommendation) =>
  recommendation?.project?._id || recommendation?.project || '';

export const recommendationProjectName = (recommendation) =>
  recommendation?.project?.name || 'an unspecified project';

/**
 * Active (recommended / interviewing) recommendations aimed at a different
 * project than `projectId` — used to warn before pitching the same intern
 * elsewhere.
 */
export const activeRecommendationsOnOtherProjects = (recommendations = [], projectId) =>
  recommendations.filter(
    (recommendation) =>
      isActivePipelineRecommendation(recommendation) &&
      recommendationProjectId(recommendation) &&
      recommendationProjectId(recommendation) !== projectId
  );

export const getRecommendationStatusLabel = (status) =>
  RECOMMENDATION_STATUSES.find((option) => option.value === status)?.label ?? status;

export const getRecommendationResultLabel = (result) =>
  RECOMMENDATION_RESULTS.find((option) => option.value === result)?.label ?? result;

export const getRecommendationStatusVariant = (status) => {
  if (status === 'resulted') return 'success';
  if (status === 'interviewing') return 'warning';
  if (status === 'recommended') return 'default';
  return 'outline';
};

export const getRecommendationResultVariant = (result) => {
  if (result === 'placed') return 'success';
  if (result === 'not_placed') return 'destructive';
  return 'outline';
};

/**
 * Tone keys for `helpers/badgeTones` — the flat chip used on the overhauled
 * surfaces, as opposed to the bordered `Badge` variants above. Both spellings of
 * the same three states exist because the overhaul has not reached every screen.
 */
export const getRecommendationStatusTone = (status) => {
  if (status === 'resulted') return 'success';
  if (status === 'interviewing') return 'warning';
  if (status === 'recommended') return 'primary';
  return 'neutral';
};

export const getRecommendationResultTone = (result) => {
  if (result === 'placed') return 'success';
  if (result === 'not_placed') return 'danger';
  return 'neutral';
};
