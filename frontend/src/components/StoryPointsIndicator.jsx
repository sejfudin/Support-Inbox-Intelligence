import { normalizeStoryPoints } from '@/helpers/storyPoints';

export default function StoryPointsIndicator({ value }) {
  const points = normalizeStoryPoints(value);

  if (points === null) {
    return <span className="text-muted-foreground">-</span>;
  }

  return <span className="text-sm font-medium text-foreground">{points}</span>;
}
