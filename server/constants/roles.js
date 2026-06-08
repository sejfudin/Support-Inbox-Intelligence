const ROLES = Object.freeze({
  ADMIN: 'admin',
  MENTOR: 'mentor',
  INTERN: 'intern',
  LEADERSHIP: 'leadership',
});

const ROLE_VALUES = Object.freeze(Object.values(ROLES));

const ROLE_OPTIONS = Object.freeze([
  {
    slug: ROLES.ADMIN,
    name: 'Admin',
    description: 'Full platform access. Manages users, reference data, and all interns.',
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

const isValidRole = (role) => ROLE_VALUES.includes(role);

module.exports = { ROLES, ROLE_VALUES, ROLE_OPTIONS, isValidRole };
