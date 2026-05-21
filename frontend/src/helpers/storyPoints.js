import { badgeTone, dotTone, indicatorTone } from '@/helpers/badgeTones';

export const STORY_POINTS_MIN = 1;
export const STORY_POINTS_MAX = 5;

export const STORY_POINTS_OPTIONS = Array.from(
  { length: STORY_POINTS_MAX - STORY_POINTS_MIN + 1 },
  (_, index) => {
    const value = STORY_POINTS_MIN + index;

    return {
      value,
      label: String(value),
    };
  }
);

export const STORY_POINTS_VISUALS = {
  1: {
    badge: badgeTone('success'),
    indicator: indicatorTone('success'),
    dot: dotTone('success'),
  },
  2: {
    badge: badgeTone('cyan'),
    indicator: indicatorTone('cyan'),
    dot: dotTone('cyan'),
  },
  3: {
    badge: badgeTone('info'),
    indicator: indicatorTone('info'),
    dot: dotTone('info'),
  },
  4: {
    badge: badgeTone('orange'),
    indicator: indicatorTone('orange'),
    dot: dotTone('orange'),
  },
  5: {
    badge: badgeTone('danger'),
    indicator: indicatorTone('danger'),
    dot: dotTone('danger'),
  },
  default: {
    badge: badgeTone('neutral'),
    indicator: indicatorTone('neutral'),
    dot: dotTone('neutral'),
  },
};

export const getStoryPointsStyle = (value) =>
  STORY_POINTS_VISUALS[value] || STORY_POINTS_VISUALS.default;

export const normalizeStoryPoints = (value) => {
  if (value === null || value === undefined || value === '') return null;

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return null;
  if (parsed < STORY_POINTS_MIN || parsed > STORY_POINTS_MAX) return null;

  return parsed;
};
