import StoryPointsField from '@/components/StoryPointsField';

export function TicketStoryPointsField({ isArchived, currentStoryPoints, onStoryPointsChange }) {
  if (isArchived) {
    return (
      <div className="space-y-3">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
          Story Points
        </span>
        <div className="flex min-h-[40px] items-center px-1 text-sm font-semibold text-foreground">
          {currentStoryPoints ? (
            `SP ${currentStoryPoints}`
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <StoryPointsField
      value={currentStoryPoints}
      onChange={onStoryPointsChange}
      className="space-y-3"
    />
  );
}
