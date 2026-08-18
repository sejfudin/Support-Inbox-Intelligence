import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Shared "card with an edit-in-place form" shell used by InternInternalCvPanel
// and InternDocumentationLinksPanel — only the view/edit body content differs.
export function InternEditablePanel({
  title,
  description,
  canEdit = false,
  isEditing,
  hasContent,
  editButtonLabel,
  onStartEditing,
  emptyMessage,
  viewContent,
  editContent,
  extraEditActions,
  onSave,
  onCancel,
  isSaving,
  saveLabel = 'Save',
  testIdPrefix,
  className,
}) {
  return (
    <div
      className={cn(
        'space-y-2 rounded-[var(--r-tile)] border border-separator p-[13px] pt-3',
        className
      )}
      data-test={`${testIdPrefix}-panel`}
    >
      <div className="space-y-0.5">
        <div className="flex items-center justify-between gap-2.5">
          <h4 className="text-[12.5px] font-semibold text-foreground">{title}</h4>
          {canEdit && !isEditing && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onStartEditing}
              className="h-[26px] shrink-0 rounded-[var(--r-badge)] px-2.5 text-[11.5px]"
              data-test={`${testIdPrefix}-edit-button`}
            >
              {editButtonLabel}
            </Button>
          )}
        </div>
        {/* Kept as a sub-line rather than dropped: the mockup's card is title +
            button only, but this sentence is what tells an admin which kind of
            link belongs here. Sized to read as a caption, not a paragraph. */}
        <p className="text-[11.5px] text-muted-foreground/75">{description}</p>
      </div>

      {!isEditing && !hasContent && (
        <p
          className="rounded-[var(--r-control)] border border-dashed border-border px-2.5 py-[18px] text-center text-[11.5px] text-muted-foreground/75"
          data-test={`${testIdPrefix}-empty-state`}
        >
          {emptyMessage}
        </p>
      )}

      {!isEditing && hasContent && viewContent}

      {isEditing && (
        <div className="space-y-4">
          {editContent}
          <div className="flex flex-wrap gap-2">
            {extraEditActions}
            <Button
              type="button"
              size="sm"
              onClick={onSave}
              disabled={isSaving}
              data-test={`${testIdPrefix}-save-button`}
            >
              {isSaving ? 'Saving...' : saveLabel}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={isSaving}
              data-test={`${testIdPrefix}-cancel-button`}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
