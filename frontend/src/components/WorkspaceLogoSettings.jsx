import { useEffect, useRef, useState } from 'react';
import { Building2, ImagePlus, Loader2, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useDeleteWorkspaceLogo, useUploadWorkspaceLogo, useWorkspace } from '@/queries/workspaces';
import {
  WORKSPACE_LOGO_ACCEPT,
  WORKSPACE_LOGO_HELPER_TEXT,
  getWorkspaceLogoValidationError,
} from '@/constants/upload';
import { cn } from '@/lib/utils';

const WorkspaceLogoSettings = ({ workspaceId }) => {
  const { data: workspace } = useWorkspace(workspaceId);
  const fileInputRef = useRef(null);
  const [logoFile, setLogoFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const uploadMutation = useUploadWorkspaceLogo(workspaceId);
  const deleteMutation = useDeleteWorkspaceLogo(workspaceId);

  const isBusy = uploadMutation.isPending || deleteMutation.isPending;

  useEffect(() => {
    if (!logoFile) {
      setPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(logoFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  const clearSelection = () => {
    setLogoFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0] || null;
    if (!file) {
      clearSelection();
      return;
    }

    const validationError = getWorkspaceLogoValidationError(file);
    if (validationError) {
      toast.error(validationError);
      clearSelection();
      return;
    }

    setLogoFile(file);
  };

  const handleUpload = () => {
    if (!logoFile) return;

    uploadMutation.mutate(logoFile, {
      onSuccess: () => {
        toast.success('Workspace logo updated.');
        clearSelection();
      },
      onError: (err) => {
        toast.error(err?.response?.data?.message || 'Failed to upload workspace logo.');
      },
    });
  };

  const handleDelete = () => {
    deleteMutation.mutate(undefined, {
      onSuccess: () => {
        toast.success('Workspace logo removed.');
        clearSelection();
      },
      onError: (err) => {
        toast.error(err?.response?.data?.message || 'Failed to delete workspace logo.');
      },
    });
  };

  const displayUrl = previewUrl || workspace?.logoUrl;
  const hasLogo = Boolean(workspace?.logoUrl);
  const hasPendingChange = Boolean(logoFile);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Workspace Logo</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{WORKSPACE_LOGO_HELPER_TEXT}</p>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-5">
          <div
            className={cn(
              'relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/50',
              hasPendingChange && 'ring-2 ring-primary/30 ring-offset-2'
            )}
          >
            {displayUrl ? (
              <img
                src={displayUrl}
                alt={`${workspace?.name || 'Workspace'} logo`}
                className="h-full w-full object-cover"
              />
            ) : (
              <Building2 className="h-8 w-8 text-muted-foreground/70" aria-hidden />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">
              {hasPendingChange ? 'New logo selected' : hasLogo ? 'Logo uploaded' : 'No logo yet'}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {hasPendingChange
                ? logoFile.name
                : hasLogo
                  ? 'Shown in the sidebar and workspace switcher.'
                  : 'Add a square image so your workspace is easy to recognize.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
            <input
              ref={fileInputRef}
              id="workspace-logo-file"
              type="file"
              accept={WORKSPACE_LOGO_ACCEPT}
              className="sr-only"
              onChange={handleFileChange}
              disabled={isBusy}
              data-test="workspace-logo-file-input"
            />

            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isBusy}
              className="gap-1.5"
              onClick={() => fileInputRef.current?.click()}
              data-test="workspace-logo-choose-button"
            >
              <ImagePlus className="h-3.5 w-3.5" />
              {hasLogo ? 'Change image' : 'Choose image'}
            </Button>

            {hasPendingChange && (
              <>
                <Button
                  type="button"
                  size="sm"
                  disabled={isBusy}
                  onClick={handleUpload}
                  className="gap-1.5"
                  data-test="workspace-logo-save-button"
                >
                  {uploadMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  Save
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={isBusy}
                  onClick={clearSelection}
                  aria-label="Clear selected image"
                  data-test="workspace-logo-clear-selection-button"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </>
            )}

            {hasLogo && !hasPendingChange && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={isBusy}
                onClick={handleDelete}
                className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                data-test="workspace-logo-remove-button"
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Remove
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkspaceLogoSettings;
