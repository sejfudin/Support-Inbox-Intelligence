import { useParams } from 'react-router-dom';
import { IntegrationSettings } from '@/components/IntegrationSettings';
import CategorySettings from '@/components/CategorySettings';
import StatusSettings from '@/components/StatusSettings';
import WorkspaceLogoSettings from '@/components/WorkspaceLogoSettings';
import { Card, CardContent } from '@/components/ui/card';
import { Loader, useLoaderHold } from '@/components/ui/loader';
import { useWorkspace } from '@/queries/workspaces';
import PageHeading from '@/components/PageHeading';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

const WorkspaceSettingsPage = () => {
  const { id } = useParams();
  const { data: workspace, isLoading: isLoadingRaw } = useWorkspace(id);
  // Global hold: keeps the mark up for MIN_VISIBLE_MS once it appears, and until the data is in.
  const isLoading = useLoaderHold(isLoadingRaw);

  useDocumentTitle(workspace?.name ? `${workspace.name} settings` : '');

  // Four settings panels, each fetching its own resource, so there is no single shape to
  // stand in for the page — and the heading itself is the workspace name, which is what this
  // query is waiting for. The loader covers the wait instead.
  if (isLoading) {
    return (
      <div className="app-page">
        <Loader variant="panel" size="md" label="Loading workspace settings…" className="mt-24" />
      </div>
    );
  }

  return (
    <div className="app-page">
      <div className="app-page-content space-y-6">
        <PageHeading
          crumb="Workspace"
          title={workspace.name}
          subtitle={
            workspace.description || 'Configure settings and integrations for this workspace.'
          }
        />

        <Card className="pt-6">
          <CardContent>
            <WorkspaceLogoSettings workspaceId={id} />
          </CardContent>
        </Card>

        <Card className="pt-6">
          <CardContent>
            <StatusSettings workspaceId={id} />
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
