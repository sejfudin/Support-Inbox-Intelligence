export const RECOMMENDATION_STATUSES = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'interviewing', label: 'Interviewing' },
  { value: 'resulted', label: 'Resulted' },
];

export const RECOMMENDATION_RESULTS = [
  { value: 'placed', label: 'Placed' },
  { value: 'not_placed', label: 'Not placed' },
];

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
