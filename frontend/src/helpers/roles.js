export const ROLES = Object.freeze({
  ADMIN: 'admin',
  MENTOR: 'mentor',
  INTERN: 'intern',
  LEADERSHIP: 'leadership',
});

export const ROLE_VALUES = Object.freeze(Object.values(ROLES));

export const ROLE_OPTIONS = Object.freeze([
  {
    slug: ROLES.ADMIN,
    name: 'Admin',
    description: 'Full platform access. Manages users, platform settings, and all interns.',
  },
  {
    slug: ROLES.MENTOR,
    name: 'Mentor',
    description: 'Guides assigned interns. Can add comments, evaluations, and set readiness.',
  },
  {
    slug: ROLES.INTERN,
    name: 'Intern',
    description: 'Active program participant. Manages own profile and works on assigned projects.',
  },
  {
    slug: ROLES.LEADERSHIP,
    name: 'Leadership',
    description: 'TA, workforce, and other stakeholders. Dashboard and profile access.',
  },
]);

export const isAdmin = (role) => role === ROLES.ADMIN;
export const isMentor = (role) => role === ROLES.MENTOR;
export const isIntern = (role) => role === ROLES.INTERN;
export const isLeadership = (role) => role === ROLES.LEADERSHIP;

export const canManageInterns = (role) => role === ROLES.ADMIN || role === ROLES.MENTOR;
export const canManageInternDocumentationLinks = (role) =>
  role === ROLES.ADMIN || role === ROLES.LEADERSHIP;
export const canViewFepDirectory = (role) => role === ROLES.LEADERSHIP;
export const canWriteInternMentorData = (role) => role === ROLES.ADMIN || role === ROLES.MENTOR;
export const canViewComments = (role) =>
  role === ROLES.ADMIN || role === ROLES.MENTOR || role === ROLES.LEADERSHIP;

const ROLE_TONE_MAP = {
  [ROLES.ADMIN]: 'destructive',
  [ROLES.MENTOR]: 'default',
  [ROLES.INTERN]: 'secondary',
  [ROLES.LEADERSHIP]: 'outline',
};

export const getRoleTone = (slug) => ROLE_TONE_MAP[slug] ?? 'secondary';

export const getRoleLabel = (slug) =>
  ROLE_OPTIONS.find((option) => option.slug === slug)?.name ?? slug;
