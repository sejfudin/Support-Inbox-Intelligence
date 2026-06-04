const Role = require('../models/Role');

const getAllRoles = async () => {
  return Role.find().sort({ name: 1 }).lean();
};

const seedDefaultRoles = async () => {
  const defaults = [
    {
      slug: 'admin',
      name: 'Admin',
      description: 'Full platform access. Manages users, reference data, and all interns.',
      isSystem: true,
    },
    {
      slug: 'mentor',
      name: 'Mentor',
      description: 'Guides assigned interns. Can add comments, evaluations, and set readiness.',
      isSystem: true,
    },
    {
      slug: 'intern',
      name: 'Intern',
      description: 'Active program participant. Manages own profile and works on assigned projects.',
      isSystem: true,
    },
    {
      slug: 'leadership',
      name: 'Leadership',
      description: 'TA, workforce, and client-facing stakeholders. Dashboard and profile access.',
      isSystem: true,
    },
  ];

  for (const role of defaults) {
    await Role.updateOne({ slug: role.slug }, { $setOnInsert: role }, { upsert: true });
  }
};

module.exports = { getAllRoles, seedDefaultRoles };
