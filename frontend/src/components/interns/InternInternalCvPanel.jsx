import { useState } from 'react';
import { ExternalLink, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUpdateInternalCvLink } from '@/queries/interns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function InternInternalCvPanel({
  userId,
  internalCvUrl,
  internName,
  canEdit = false,
  className,
}) {
  const { mutate, isPending } = useUpdateInternalCvLink();
  const [isEditing, setIsEditing] = useState(false);
  const [draftUrl, setDraftUrl] = useState('');

  const hasLink = Boolean(internalCvUrl);

  const handleStartEditing = () => {
    setDraftUrl(internalCvUrl || '');
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setDraftUrl('');
  };

  const handleSave = () => {
    mutate(
      { userId, url: draftUrl.trim() },
      {
        onSuccess: () => {
          toast.success('Internal CV link updated');
          setIsEditing(false);
        },
        onError: (err) =>
          toast.error(err?.response?.data?.message || 'Failed to update internal CV link'),
      }
    );
  };

  return (
    <div
      className={cn('space-y-4 rounded-2xl border border-border/60 p-5', className)}
      data-test="intern-internal-cv-panel"
    >
      <div className="space-y-1">
        <div className="flex items-start justify-between gap-3">
          <h4 className="text-sm font-semibold">CV / Résumé</h4>
          {canEdit && !isEditing && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleStartEditing}
              className="shrink-0"
              data-test="intern-internal-cv-edit-button"
            >
              {hasLink ? 'Edit link' : 'Add link'}
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">Google Drive link to the candidate's CV.</p>
      </div>

      {!isEditing && !hasLink && (
        <p
          className="rounded-xl border border-dashed border-border/60 px-4 py-8 text-center text-sm text-muted-foreground"
          data-test="intern-internal-cv-empty-state"
        >
          No CV link added yet.
        </p>
      )}

      {!isEditing && hasLink && (
        <a
          href={internalCvUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-xl border border-border/60 px-4 py-3 text-sm transition-colors hover:bg-muted/30"
          data-test="intern-internal-cv-link"
        >
          <FileText className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">
              {internName ? `${internName} — CV` : 'CV'}
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              Opens in Google Drive
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </span>
          </span>
        </a>
      )}

      {isEditing && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="intern-internal-cv-url">Google Drive URL</Label>
            <Input
              id="intern-internal-cv-url"
              type="url"
              value={draftUrl}
              onChange={(event) => setDraftUrl(event.target.value)}
              placeholder="https://drive.google.com/..."
              data-test="intern-internal-cv-url-input"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={isPending}
              data-test="intern-internal-cv-save-button"
            >
              {isPending ? 'Saving...' : 'Save link'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={isPending}
              data-test="intern-internal-cv-cancel-button"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
