import { ROLES } from '@/helpers/roles';

export const SYMPHONY_EMAIL_DOMAIN = 'symphony.is';
export const DEFAULT_HUB_NAME = 'Sarajevo';
export const DEFAULT_INTERNSHIP_TYPE_SLUG = 'fep';

export const skipsWorkspaceSelection = (role) => role === ROLES.ADMIN || role === ROLES.LEADERSHIP;

export const showsWorkspaceSelection = (role) => role === ROLES.MENTOR || role === ROLES.INTERN;

export const isInternRole = (role) => role === ROLES.INTERN;

const normalizeEmailPart = (value) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

export const getTodayIsoDate = () => {
  const date = new Date();
  const pad = (part) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export const buildSuggestedEmail = (fullName) => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';

  const first = normalizeEmailPart(parts[0]);
  if (!first) return '';

  const last = parts.length > 1 ? normalizeEmailPart(parts[parts.length - 1]) : '';
  const localPart = last ? `${first}.${last}` : first;

  return `${localPart}@${SYMPHONY_EMAIL_DOMAIN}`;
};

export const findDefaultHubId = (hubs) =>
  hubs.find((hub) => hub.name === DEFAULT_HUB_NAME)?._id || '';

export const findDefaultInternshipTypeId = (internshipTypes) =>
  internshipTypes.find((type) => type.slug === DEFAULT_INTERNSHIP_TYPE_SLUG)?._id || '';

export const buildRegisterPayload = (data) => {
  const workspaceSkipped = skipsWorkspaceSelection(data.role);
  const workspaceSelected = data.workspaceId && data.workspaceId !== 'none';

  const payload = {
    fullName: data.fullName,
    email: data.email,
    role: data.role,
    hubId: data.hubId,
    workspaceId: workspaceSkipped || !workspaceSelected ? undefined : data.workspaceId,
    workspaceRole: workspaceSkipped || !workspaceSelected ? undefined : data.workspaceRole,
  };

  if (isInternRole(data.role)) {
    payload.internshipTypeId = data.internshipTypeId;
    payload.primaryMentorId = data.primaryMentorId;
    payload.startDate = data.startDate;
  }

  return payload;
};

export const getRegisterDefaultValues = () => ({
  fullName: '',
  email: '',
  role: ROLES.INTERN,
  hubId: '',
  workspaceId: 'none',
  workspaceRole: 'member',
  internshipTypeId: '',
  primaryMentorId: '',
  startDate: getTodayIsoDate(),
});

/** @deprecated Use getRegisterDefaultValues() for a fresh start date. */
export const REGISTER_DEFAULT_VALUES = getRegisterDefaultValues();
