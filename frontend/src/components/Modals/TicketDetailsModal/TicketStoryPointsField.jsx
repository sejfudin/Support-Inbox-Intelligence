import StoryPointsField from '@/components/StoryPointsField';

/**
 * `bare` drops the component's own caption — inside the meta rail the field sits
 * under a `RailField` label already, and two "Story points" headings stacked on
 * top of each other is what the accordion layout used to produce.
 */
export function TicketStoryPointsField({
  isArchived,
  currentStoryPoints,
  onStoryPointsChange,
  bare = false,
}) {
  if (isArchived) {
    return (
      <span className="text-[12.5px] font-medium text-foreground">
        {currentStoryPoints ? (
          `SP ${currentStoryPoints}`
        ) : (
          <span className="text-muted-foreground/75">—</span>
        )}
      </span>
    );
  }

  return (
    <StoryPointsField
      value={currentStoryPoints}
      onChange={onStoryPointsChange}
      hideLabel={bare}
      className={bare ? undefined : 'space-y-3'}
    />
  );
}
