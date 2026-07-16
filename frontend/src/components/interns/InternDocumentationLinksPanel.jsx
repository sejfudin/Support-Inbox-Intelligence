import { useEffect, useState } from 'react';
import { ExternalLink, Link2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUpdateInternDocumentationLinks } from '@/queries/interns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const emptyLink = () => ({ label: '', url: '' });

export function InternDocumentationLinksPanel({ userId, links = [], canEdit = false, className }) {
  const { mutate, isPending } = useUpdateInternDocumentationLinks();
  const [isEditing, setIsEditing] = useState(false);
  const [draftLinks, setDraftLinks] = useState([]);

  useEffect(() => {
    if (!isEditing) {
      setDraftLinks(
        (links || []).map((link) => ({
          label: link.label || '',
          url: link.url || '',
        }))
      );
    }
  }, [links, isEditing]);

  const handleStartEditing = () => {
    setDraftLinks(
      links.length > 0
        ? links.map((link) => ({ label: link.label || '', url: link.url || '' }))
        : [emptyLink()]
    );
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setDraftLinks(
      (links || []).map((link) => ({
        label: link.label || '',
        url: link.url || '',
      }))
    );
  };

  const handleSave = () => {
    const payload = draftLinks
      .map((link) => ({
        label: link.label.trim(),
        url: link.url.trim(),
      }))
      .filter((link) => link.label || link.url);

    mutate(
      { userId, links: payload },
      {
        onSuccess: () => {
          toast.success('Documentation links updated');
          setIsEditing(false);
        },
        onError: (err) =>
          toast.error(err?.response?.data?.message || 'Failed to update documentation links'),
      }
    );
  };

  const updateDraftLink = (index, field, value) => {
    setDraftLinks((current) =>
      current.map((link, linkIndex) => (linkIndex === index ? { ...link, [field]: value } : link))
    );
  };

  const removeDraftLink = (index) => {
    setDraftLinks((current) => current.filter((_, linkIndex) => linkIndex !== index));
  };

  const hasLinks = links.length > 0;

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold">Documentation</h4>
          <p className="mt-1 text-sm text-muted-foreground">
            Related documents for this candidate.
          </p>
        </div>
        {canEdit && !isEditing && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleStartEditing}
            data-test="intern-documentation-edit-button"
          >
            {hasLinks ? 'Edit links' : 'Add links'}
          </Button>
        )}
      </div>

      {!isEditing && !hasLinks && (
        <p className="rounded-xl border border-dashed border-border/60 px-4 py-8 text-center text-sm text-muted-foreground">
          No documentation links yet.
        </p>
      )}

      {!isEditing && hasLinks && (
        <ul className="space-y-2">
          {links.map((link) => (
            <li key={link._id || `${link.label}-${link.url}`}>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 rounded-xl border border-border/60 px-4 py-3 text-sm transition-colors hover:bg-muted/30"
                data-test={`intern-documentation-link-${link._id || link.label}`}
              >
                <span className="flex min-w-0 items-center gap-2 font-medium">
                  <Link2 className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="truncate">{link.label}</span>
                </span>
                <ExternalLink
                  className="h-4 w-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </a>
            </li>
          ))}
        </ul>
      )}

      {isEditing && (
        <div className="space-y-4">
          <div className="max-h-[min(24rem,50vh)] space-y-3 overflow-y-auto pr-1">
            {draftLinks.map((link, index) => (
              <div
                key={`draft-${index}`}
                className="grid gap-3 rounded-xl border border-border/60 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]"
              >
                <div className="min-w-0 space-y-2">
                  <Label htmlFor={`intern-doc-label-${index}`}>Label</Label>
                  <Input
                    id={`intern-doc-label-${index}`}
                    value={link.label}
                    onChange={(event) => updateDraftLink(index, 'label', event.target.value)}
                    placeholder="e.g. Evaluation report"
                    data-test={`intern-documentation-label-input-${index}`}
                  />
                </div>
                <div className="min-w-0 space-y-2">
                  <Label htmlFor={`intern-doc-url-${index}`}>URL</Label>
                  <Input
                    id={`intern-doc-url-${index}`}
                    type="url"
                    value={link.url}
                    onChange={(event) => updateDraftLink(index, 'url', event.target.value)}
                    placeholder="https://..."
                    className="min-w-0"
                    data-test={`intern-documentation-url-input-${index}`}
                  />
                </div>
                <div className="flex items-end md:justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeDraftLink(index)}
                    aria-label="Remove link"
                    data-test={`intern-documentation-remove-button-${index}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDraftLinks((current) => [...current, emptyLink()])}
              data-test="intern-documentation-add-button"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add link
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={isPending}
              data-test="intern-documentation-save-button"
            >
              {isPending ? 'Saving...' : 'Save links'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={isPending}
              data-test="intern-documentation-cancel-button"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
