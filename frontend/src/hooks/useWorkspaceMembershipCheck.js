import { useEffect, useMemo, useState } from "react";
import { useMyWorkspaces } from "@/queries/workspaces";

export function useWorkspaceMembershipCheck(workspaceId) {
  const {
    data: myWorkspaces = [],
    isLoading: isMyWorkspacesLoading,
    isFetching: isMyWorkspacesFetching,
    isError: isMyWorkspacesError,
    refetch: refetchMyWorkspaces,
  } = useMyWorkspaces();

  const [membershipCheckWorkspaceId, setMembershipCheckWorkspaceId] = useState(null);

  useEffect(() => {
    const activeWorkspaceId = workspaceId?.toString() || null;

    if (!activeWorkspaceId) {
      setMembershipCheckWorkspaceId(null);
      return;
    }

    let isCancelled = false;

    setMembershipCheckWorkspaceId(null);
    refetchMyWorkspaces().finally(() => {
      if (!isCancelled) {
        setMembershipCheckWorkspaceId(activeWorkspaceId);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [workspaceId, refetchMyWorkspaces]);

  const isWorkspaceMember = useMemo(() => {
    if (!workspaceId) return false;
    return myWorkspaces.some((workspace) => workspace._id?.toString() === workspaceId.toString());
  }, [myWorkspaces, workspaceId]);

  const isMembershipCheckPending = Boolean(
    workspaceId && (
      isMyWorkspacesLoading ||
      isMyWorkspacesFetching ||
      membershipCheckWorkspaceId !== workspaceId.toString()
    ),
  );

  return {
    isWorkspaceMember,
    isMembershipCheckPending,
    isMembershipCheckError: isMyWorkspacesError,
  };
}