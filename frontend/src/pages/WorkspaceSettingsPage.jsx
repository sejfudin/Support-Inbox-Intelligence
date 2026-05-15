import { useParams } from 'react-router-dom';
import { useWorkspace } from '@/queries/workspaces';
import { IntegrationSettings } from '@/components/IntegrationSettings';
import CategorySettings from '@/components/CategorySettings';
import StatusSettings from '@/components/StatusSettings';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import PageHeading from '@/components/PageHeading';

const WorkspaceSettingsPage = () => {
  const { id } = useParams();
  const { data: workspace, isLoading } = useWorkspace(id);

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
