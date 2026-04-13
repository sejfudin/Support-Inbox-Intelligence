import React, { useState } from "react";
import { useIntegration, useRepositories, useUpdateIntegration, useDisconnectIntegration, useInitiateGitHubInstallation } from "@/queries/github";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Github, Loader2, AlertCircle, Check, ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";

const VALID_STATUSES = ["backlog", "to do", "in progress", "on staging", "blocked", "done"];

export const IntegrationSettings = ({ workspaceId }) => {
  const { data: integrationData, isLoading: isLoadingIntegration } = useIntegration(workspaceId);
  const { data: reposData, isLoading: isLoadingRepos } = useRepositories(
    workspaceId, 
    !!integrationData?.data?.isConnected
  );
  const updateIntegration = useUpdateIntegration();
  const disconnectIntegration = useDisconnectIntegration();
  const initiateInstallation = useInitiateGitHubInstallation();

  const [isDisconnectDialogOpen, setIsDisconnectDialogOpen] = useState(false);
  const integration = integrationData?.data;
  const repositories = reposData?.data || [];

  const settings = integration?.settings || {
    autoLinkEnabled: true,
    autoMoveOnPROpenEnabled: false,
    autoMoveOnMergeEnabled: false,
    onPROpenTargetStatus: "on staging",
    onMergeTargetStatus: "done",
  };

  const selectedRepo = integration?.connectedRepo?.fullName || null;

  const handleConnect = async () => {
    try {
      const result = await initiateInstallation.mutateAsync(workspaceId);
      if (result.data?.url) {
        window.location.href = result.data.url;
      }
    } catch {
      toast.error("Failed to initiate GitHub connection");
    }
  };

  const handleRepoChange = async (fullName) => {
    const [owner, name] = fullName.split("/");

    try {
      await updateIntegration.mutateAsync({
        workspaceId,
        data: { connectedRepo: { owner, name } },
      });
      toast.success("Repository connected");
    } catch {
      toast.error("Failed to connect repository");
    }
  };

  const handleSettingChange = async (key, value) => {
    const newSettings = { ...settings, [key]: value };

    try {
      await updateIntegration.mutateAsync({
        workspaceId,
        data: { settings: newSettings },
      });
      toast.success("Settings updated");
    } catch {
      toast.error("Failed to update settings");
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectIntegration.mutateAsync(workspaceId);
      setIsDisconnectDialogOpen(false);
      toast.success("GitHub integration disconnected");
    } catch {
      toast.error("Failed to disconnect");
    }
  };

  if (isLoadingIntegration) {
    return (
      <div className="flex items-center gap-2 text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading integration settings...</span>
      </div>
    );
  }

  if (!integration?.isConnected) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center">
            <Github className="h-5 w-5 text-gray-600" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900">GitHub Integration</h3>
            <p className="text-sm text-gray-500">Connect your workspace to GitHub for automatic PR linking</p>
          </div>
        </div>

        <div className="rounded-lg border border-dashed border-gray-200 p-6 bg-gray-50/50">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
              <Github className="h-6 w-6 text-gray-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Not connected</p>
              <p className="text-xs text-gray-500 mt-1">
                Connect your GitHub repository to automatically link pull requests to tickets
              </p>
            </div>
            <Button onClick={handleConnect} disabled={initiateInstallation.isPending}>
              {initiateInstallation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Github className="h-4 w-4 mr-2" />
              )}
              Connect GitHub
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
            <Check className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900">GitHub Connected</h3>
            <p className="text-sm text-gray-500">
              Connected as {integration.githubAccountType} <strong>{integration.githubAccountLogin}</strong>
            </p>
          </div>
        </div>

        <Dialog open={isDisconnectDialogOpen} onOpenChange={setIsDisconnectDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50">
              <Trash2 className="h-4 w-4 mr-2" />
              Disconnect
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Disconnect GitHub?</DialogTitle>
              <DialogDescription>
                This will remove the integration for this workspace. Existing PR links will remain but no new PRs will be linked automatically.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDisconnectDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleDisconnect}
                variant="destructive"
              >
                Disconnect
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        <Label htmlFor="repo-select">Connected Repository</Label>
        <Select value={selectedRepo} onValueChange={handleRepoChange} disabled={isLoadingRepos}>
          <SelectTrigger id="repo-select" className="w-full">
            <SelectValue placeholder={isLoadingRepos ? "Loading repositories..." : "Select a repository"} />
          </SelectTrigger>
          <SelectContent>
            {repositories.map((repo) => (
              <SelectItem key={repo.id} value={repo.fullName}>
                <div className="flex items-center gap-2">
                  <span>{repo.fullName}</span>
                  {repo.private && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">Private</span>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedRepo && (
          <a
            href={`https://github.com/${selectedRepo}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1"
          >
            View on GitHub <ExternalLink className="h-3 w-3" />
          </a>
        )}
        {!integration?.connectedRepo?.fullName && (
          <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Select a repository to enable automation features
          </p>
        )}
      </div>

      <div className="space-y-4 border-t pt-4">
        <h4 className="font-medium text-gray-900">Automation Settings</h4>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-link" className="cursor-pointer">Auto-link pull requests</Label>
              <p className="text-xs text-gray-500">
                Automatically link PRs to tickets based on branch names like &quot;feature/87-...&quot;
              </p>
            </div>
            <Checkbox
              id="auto-link"
              checked={settings.autoLinkEnabled}
              onCheckedChange={(checked) => handleSettingChange("autoLinkEnabled", checked)}
              disabled={!selectedRepo}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-move-open" className="cursor-pointer">Move ticket when PR opened</Label>
              <p className="text-xs text-gray-500">
                Automatically change ticket status when a PR is opened
              </p>
            </div>
            <Checkbox
              id="auto-move-open"
              checked={settings.autoMoveOnPROpenEnabled}
              onCheckedChange={(checked) => handleSettingChange("autoMoveOnPROpenEnabled", checked)}
              disabled={!selectedRepo}
            />
          </div>

          {settings.autoMoveOnPROpenEnabled && (
            <div className="ml-6">
              <Label htmlFor="open-status" className="text-xs">Target status when PR opened</Label>
              <Select
                value={settings.onPROpenTargetStatus}
                onValueChange={(value) => handleSettingChange("onPROpenTargetStatus", value)}
              >
                <SelectTrigger id="open-status" className="w-full mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VALID_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-move-merge" className="cursor-pointer">Move ticket when PR merged</Label>
              <p className="text-xs text-gray-500">
                Automatically change ticket status when a PR is merged
              </p>
            </div>
            <Checkbox
              id="auto-move-merge"
              checked={settings.autoMoveOnMergeEnabled}
              onCheckedChange={(checked) => handleSettingChange("autoMoveOnMergeEnabled", checked)}
              disabled={!selectedRepo}
            />
          </div>

          {settings.autoMoveOnMergeEnabled && (
            <div className="ml-6">
              <Label htmlFor="merge-status" className="text-xs">Target status when PR merged</Label>
              <Select
                value={settings.onMergeTargetStatus}
                onValueChange={(value) => handleSettingChange("onMergeTargetStatus", value)}
              >
                <SelectTrigger id="merge-status" className="w-full mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VALID_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-start gap-2 text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        <p>
          Manual ticket changes within 5 minutes of a webhook event will not be overridden by automation.
        </p>
      </div>
    </div>
  );
};

export default IntegrationSettings;
