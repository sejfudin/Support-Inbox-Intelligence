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
      className={cn('space-y-4 rounded-2xl border border-border/60 p-5', className)}
      data-test={`${testIdPrefix}-panel`}
    >
      <div className="space-y-1">
        <div className="flex items-start justify-between gap-3">
          <h4 className="text-sm font-semibold">{title}</h4>
          {canEdit && !isEditing && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onStartEditing}
              className="shrink-0"
              data-test={`${testIdPrefix}-edit-button`}
            >
              {editButtonLabel}
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      {!isEditing && !hasContent && (
        <p
          className="rounded-xl border border-dashed border-border/60 px-4 py-8 text-center text-sm text-muted-foreground"
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
