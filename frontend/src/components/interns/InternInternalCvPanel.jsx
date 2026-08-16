import { useState } from 'react';
import { ExternalLink, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUpdateInternalCvLink } from '@/queries/interns';
import { toast } from 'sonner';
import { InternEditablePanel } from '@/components/interns/InternEditablePanel';

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
    <InternEditablePanel
      className={className}
      testIdPrefix="intern-internal-cv"
      title="CV / Résumé"
      description="Google Drive link to the candidate's CV."
      canEdit={canEdit}
      isEditing={isEditing}
      hasContent={hasLink}
      editButtonLabel={hasLink ? 'Edit link' : 'Add link'}
      onStartEditing={handleStartEditing}
      emptyMessage="No CV link added yet."
      onSave={handleSave}
      onCancel={handleCancel}
      isSaving={isPending}
      saveLabel="Save link"
      viewContent={
        <a
          href={internalCvUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 rounded-[var(--r-control)] border border-separator px-3 py-2.5 text-[12.5px] transition-colors hover:bg-accent/60"
          data-test="intern-internal-cv-link"
        >
          <FileText className="h-4 w-4 shrink-0 accent-ink" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">
              {internName ? `${internName} — CV` : 'CV'}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground/75">
              Opens in Google Drive
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </span>
          </span>
        </a>
      }
      editContent={
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
      }
    />
  );
}
