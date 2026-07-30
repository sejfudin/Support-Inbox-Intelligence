/**
 * Phase 1 — identity: users, workspaces + membership, ticket statuses,
 * categories, and intern profiles.
 *
 * Everything downstream joins onto what this phase puts in `ctx`, so it runs
 * first and populates `ctx.users`, `ctx.workspaces`, `ctx.statuses` and
 * `ctx.profiles` keyed by the symbolic keys from demo/dataset.js.
 */

const User = require('../../models/User');
const Workspace = require('../../models/Workspace');
const Category = require('../../models/Category');
const InternProfile = require('../../models/InternProfile');
const { seedDefaultStatuses } = require('../../services/statusService');
const { stableId } = require('./clock');

const ROSTER_STATUSES = ['active', 'ready'];

const createUsers = async (ctx) => {
  const { data, ref, passwordHash } = ctx;
  const keys = [];
  const docs = [];

  const push = (spec) => {
    // `account` lets a spec opt into a non-active login (e.g. a discontinued
    // intern whose access was revoked). Defaults to a normal active account.
    const account = spec.account || { active: true, status: 'active' };
    keys.push(spec.key);
    docs.push({
      _id: stableId(`user:${spec.key}`),
      fullname: spec.fullname,
      email: spec.email,
      // No password-hashing hook exists on User (see models/User.js) — the hash
      // is computed once in the orchestrator and written directly.
      password: passwordHash,
      // `role` defaults to 'admin' on the schema, so it is always explicit here.
      role: spec.role,
      hub: ref.hubByName(spec.hub)._id,
      active: account.active,
      status: account.status,
      passwordSetAt: ctx.clock.now,
    });
  };

  data.heroes.forEach(push);
  data.mentors.forEach(push);
  // Interns that aren't already a hero (the hero intern is defined in `heroes`,
  // and appears again in `interns` to get a profile).
  data.interns
    .filter((intern) => !data.heroes.some((hero) => hero.key === intern.key))
    .forEach((intern) => push({ ...intern, role: 'intern' }));

  // insertMany preserves input order, so index-matching is exact — no need to
  // re-derive the key from the email.
  const created = await User.insertMany(docs);
  created.forEach((user, index) => ctx.users.set(keys[index], user));
  ctx.counts.users = created.length;
};

const createWorkspaces = async (ctx) => {
  const { data, clock } = ctx;

  const rosterInternKeys = data.interns
    .filter((intern) => ROSTER_STATUSES.includes(intern.status))
    .map((intern) => intern.key);

  for (const spec of data.workspaces) {
    const internKeys =
      spec.internMemberKeys === 'roster' ? rosterInternKeys : spec.internMemberKeys || [];

    const members = [
      ...spec.staffMembers.map((member) => ({
        user: ctx.users.get(member.key)._id,
        role: member.role,
        // Members must be 'active' to show up in the dailies picker
        // (dailyService.getActiveInterns filters on it).
        status: 'active',
        invitedBy: ctx.users.get(spec.ownerKey)._id,
        joinedAt: clock.at(clock.workdaysAgo(60), 9, 0),
      })),
      ...internKeys.map((key) => ({
        user: ctx.users.get(key)._id,
        role: 'member',
        status: 'active',
        invitedBy: ctx.users.get(spec.ownerKey)._id,
        joinedAt: clock.at(clock.workdaysAgo(40), 9, 0),
      })),
    ];

    const workspace = await Workspace.create({
      _id: stableId(`workspace:${spec.key}`),
      name: spec.name,
      description: spec.description,
      owner: ctx.users.get(spec.ownerKey)._id,
      members,
    });
    ctx.workspaces.set(spec.key, workspace);

    // The home workspace becomes User.workspaceId for its members — without
    // this the dailies and ticket screens 404 for that user.
    if (spec.isHome) {
      await User.updateMany(
        { _id: { $in: members.map((member) => member.user) } },
        { $set: { workspaceId: workspace._id } }
      );
    }

    const statuses = await seedDefaultStatuses(workspace._id);
    // Keyed per workspace, never a flat slug map: cross-workspace status refs
    // are not schema-enforced, so a flat map is how you silently create a
    // ticket pointing at another workspace's status.
    ctx.statuses.set(spec.key, new Map(statuses.map((status) => [status.slug, status])));
  }

  ctx.counts.workspaces = data.workspaces.length;
};

const createCategories = async (ctx) => {
  const docs = ctx.data.categories.map((spec) => ({
    _id: stableId(`category:${spec.key}`),
    name: spec.name,
    color: spec.color,
    workspace: ctx.workspaces.get(spec.workspaceKey)._id,
  }));
  const created = await Category.insertMany(docs);
  created.forEach((category, index) => {
    ctx.categories.set(ctx.data.categories[index].key, category);
  });
  ctx.counts.categories = created.length;
};

const createInternProfiles = async (ctx) => {
  const { data, ref, clock } = ctx;

  const docs = data.interns.map((spec) => {
    const startKey = clock.workdaysAgo(spec.startWorkdaysAgo);
    return {
      _id: stableId(`profile:${spec.key}`),
      user: ctx.users.get(spec.key)._id,
      internshipType: ref.programmeBySlug(spec.programme)._id,
      primaryMentor: ctx.users.get(spec.mentorKey)._id,
      startDate: clock.startOfDay(startKey),
      status: spec.status,
      // Six months from start — enough that active interns look mid-programme.
      expectedEndDate: clock.startOfDay(clock.shiftKey(startKey, 180)),
      selfTechnologies: (spec.technologies || []).map((slug) => ref.techBySlug(slug)._id),
      declaredPosition: ref.positionBySlug(spec.position)._id,
      documentationLinks: spec.docs || [],
    };
  });

  const created = await InternProfile.insertMany(docs);
  created.forEach((profile, index) => ctx.profiles.set(data.interns[index].key, profile));
  ctx.counts.internProfiles = created.length;
};

const run = async (ctx) => {
  await createUsers(ctx);
  await createWorkspaces(ctx);
  await createCategories(ctx);
  await createInternProfiles(ctx);
};

module.exports = { run, ROSTER_STATUSES };
