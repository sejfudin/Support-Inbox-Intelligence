export const ROLES = Object.freeze({
  ADMIN: 'admin',
  MENTOR: 'mentor',
  INTERN: 'intern',
  LEADERSHIP: 'leadership',
});

export const isAdmin = (role) => role === ROLES.ADMIN;
export const isMentor = (role) => role === ROLES.MENTOR;
export const isIntern = (role) => role === ROLES.INTERN;
export const isLeadership = (role) => role === ROLES.LEADERSHIP;

export const canManageInterns = (role) => role === ROLES.ADMIN || role === ROLES.MENTOR;
export const canViewComments = (role) => role === ROLES.ADMIN || role === ROLES.MENTOR || role === ROLES.LEADERSHIP;

const ROLE_TONE_MAP = {
  [ROLES.ADMIN]: 'destructive',
  [ROLES.MENTOR]: 'default',
  [ROLES.INTERN]: 'secondary',
  [ROLES.LEADERSHIP]: 'outline',
};

export const getRoleTone = (slug) => ROLE_TONE_MAP[slug] ?? 'secondary';
