import { ROLES } from '@/helpers/roles';

export const skipsWorkspaceSelection = (role) =>
  role === ROLES.ADMIN || role === ROLES.LEADERSHIP;

export const showsWorkspaceSelection = (role) =>
  role === ROLES.MENTOR || role === ROLES.INTERN;

export const isInternRole = (role) => role === ROLES.INTERN;

export const buildRegisterPayload = (data) => {
  const workspaceSkipped = skipsWorkspaceSelection(data.role);
  const workspaceSelected = data.workspaceId && data.workspaceId !== 'none';

  const payload = {
    fullName: data.fullName,
    email: data.email,
    role: data.role,
    hubId: data.hubId,
    workspaceId: workspaceSkipped || !workspaceSelected ? undefined : data.workspaceId,
    workspaceRole:
      workspaceSkipped || !workspaceSelected ? undefined : data.workspaceRole,
  };

  if (isInternRole(data.role)) {
    payload.internshipTypeId = data.internshipTypeId;
    payload.primaryMentorId = data.primaryMentorId;
    payload.secondaryMentorId =
      data.secondaryMentorId && data.secondaryMentorId !== 'none'
        ? data.secondaryMentorId
        : undefined;
    payload.startDate = data.startDate;
  }

  return payload;
};

export const REGISTER_DEFAULT_VALUES = {
  fullName: '',
  email: '',
  role: '',
  hubId: '',
  workspaceId: 'none',
  workspaceRole: 'member',
  internshipTypeId: '',
  primaryMentorId: '',
  secondaryMentorId: 'none',
  startDate: '',
};
