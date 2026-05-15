import { useParams } from 'react-router-dom';
import { IntegrationSettings } from '@/components/IntegrationSettings';
import CategorySettings from '@/components/CategorySettings';
import { Card, CardContent } from '@/components/ui/card';
import { useState } from 'react';
import { Building2, Loader2, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDeleteWorkspaceLogo, useUploadWorkspaceLogo, useWorkspace } from '@/queries/workspaces';
import {
  WORKSPACE_LOGO_ACCEPT,
  WORKSPACE_LOGO_HELPER_TEXT,
  getWorkspaceLogoValidationError,
} from '@/constants/upload';
import PageHeading from '@/components/PageHeading';

const WorkspaceSettingsPage = () => {
  const { id } = useParams();
  const { data: workspace, isLoading } = useWorkspace(id);

  const [logoFile, setLogoFile] = useState(null);

  const uploadWorkspaceLogo = useUploadWorkspaceLogo(id);
  const deleteWorkspaceLogo = useDeleteWorkspaceLogo(id);

  const validateLogoFile = (file) => {
    const validationError = getWorkspaceLogoValidationError(file, { required: true });
    if (validationError) {
      toast.error(validationError);
      return false;
    }
    return true;
  };

  const handleUploadLogo = () => {
    if (!validateLogoFile(logoFile)) return;

    uploadWorkspaceLogo.mutate(logoFile, {
      onSuccess: () => {
        toast.success('Workspace logo updated.');
        setLogoFile(null);
      },
      onError: (err) => {
        toast.error(err?.response?.data?.message || 'Failed to upload workspace logo.');
      },
    });
  };

  const handleDeleteLogo = () => {
    deleteWorkspaceLogo.mutate(undefined, {
      onSuccess: () => {
        toast.success('Workspace logo removed.');
        setLogoFile(null);
      },
      onError: (err) => {
        toast.error(err?.response?.data?.message || 'Failed to delete workspace logo.');
      },
    });
  };



  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="app-page">
      <div className="app-page-content space-y-6">
        <PageHeading
          kicker="Workspace settings"
          title={workspace.name}
          subtitle={
            workspace.description || 'Configure settings and integrations for this workspace.'
          }
        />

        <Card className="pt-6">
          <CardContent className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Workspace Logo
            </h2>

            <div className="flex items-center gap-4">
              {workspace?.logoUrl ? (
                <img
                  src={workspace.logoUrl}
                  alt={`${workspace.name} logo`}
                  className="h-16 w-16 rounded-xl object-cover border"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-xl border bg-muted">
                  <Building2 className="h-7 w-7 text-muted-foreground" />
                </div>
              )}

              <div className="text-sm text-muted-foreground">
                {WORKSPACE_LOGO_HELPER_TEXT}
              </div>
            </div>

            <Input
              type="file"
              accept={WORKSPACE_LOGO_ACCEPT}
              onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
            />

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={handleUploadLogo}
                disabled={!logoFile || uploadWorkspaceLogo.isPending}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                {uploadWorkspaceLogo.isPending ? 'Uploading...' : workspace?.logoUrl ? 'Replace Logo' : 'Upload Logo'}
              </Button>

              {workspace?.logoUrl && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDeleteLogo}
                  disabled={deleteWorkspaceLogo.isPending}
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  {deleteWorkspaceLogo.isPending ? 'Removing...' : 'Remove Logo'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="pt-6">
          <CardContent>
            <CategorySettings workspaceId={id} />
          </CardContent>
        </Card>

        <Card className="pt-6">
          <CardContent>
            <IntegrationSettings workspaceId={id} />
          </CardContent>
        </Card>

      </div>
    </div>
  );
};

export default WorkspaceSettingsPage;
