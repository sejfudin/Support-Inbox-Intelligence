import { useParams } from "react-router-dom";
import { useWorkspace } from "@/queries/workspaces";
import { IntegrationSettings } from "@/components/IntegrationSettings";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Settings } from "lucide-react";

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
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.1rem] bg-primary/10 sm:h-14 sm:w-14 sm:rounded-[1.25rem]">
            <Settings className="h-7 w-7 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="app-kicker mb-3">Workspace Settings</div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="break-words text-2xl font-bold text-gray-900">{workspace.name}</h1>
            </div>
            {workspace.description && (
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{workspace.description}</p>
            )}
          </div>
        </div>

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
