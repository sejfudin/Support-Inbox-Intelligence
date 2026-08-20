import { normalizeStoryPoints } from '@/helpers/storyPoints';

/**
 * `tone="list"` is the ticket list's cell from the mockup — 12.5px secondary,
 * matching the due date beside it. The default stays the bolder foreground
 * number the board and the modal render.
 */
export default function StoryPointsIndicator({ value, tone = 'default' }) {
  const points = normalizeStoryPoints(value);
  const isList = tone === 'list';

  if (points === null) {
    return (
      <span className={isList ? 'text-[12.5px] text-muted-foreground/60' : 'text-muted-foreground'}>
        {isList ? '—' : '-'}
      </span>
    );
  }

  return (
    <span
      className={
        isList
          ? 'text-[12.5px] tabular-nums text-muted-foreground'
          : 'text-sm font-medium text-foreground'
      }
    >
      {points}
    </span>
  );
}
