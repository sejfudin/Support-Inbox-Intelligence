export const getUserId = (user) => (user?._id ?? user?.id)?.toString() ?? null;

export const isPlatformAdmin = (user) => user?.role === 'admin';

export const isWorkspaceAdminMember = (user, workspace) => {
  const userId = getUserId(user);
  if (!userId || !workspace) return false;

  const ownerId = (workspace.owner?._id ?? workspace.owner)?.toString();
  if (ownerId === userId) return true;

  return workspace.members?.some(
    (member) =>
      member.status === 'active' &&
      (member.user?._id ?? member.user)?.toString() === userId &&
      member.role === 'admin'
  );
};

export const canManageWorkspace = (user, workspace) => {
  if (!user || !workspace) return false;
  if (isPlatformAdmin(user)) return true;
  return isWorkspaceAdminMember(user, workspace);
};

export const canAccessWorkspaceManagementRoute = (user, workspace, workspaceId) => {
  if (!canManageWorkspace(user, workspace)) return false;
  if (isPlatformAdmin(user)) return true;
  return getUserId(user) && user?.workspaceId?.toString() === workspaceId?.toString();
};
