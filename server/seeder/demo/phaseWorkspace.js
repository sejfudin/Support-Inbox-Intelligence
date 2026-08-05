/**
 * Phase 2 — workspace activity: client projects, the ticket board, comments,
 * ticket history, notifications, and the daily stand-ups.
 *
 * Order inside the phase matters: projects before recommendations can reference
 * them (phaseTalent), tickets before comments/history/notifications, and
 * dailies last because a blocker may link a ticket.
 */

const Project = require('../../models/Project');
const Ticket = require('../../models/Ticket');
const Comment = require('../../models/Comment');
const History = require('../../models/History');
const Notification = require('../../models/Notification');
const Daily = require('../../models/Daily');
const { slugify } = require('../../helpers/slugify');
const { stableId } = require('./clock');

const createProjects = async (ctx) => {
  const docs = ctx.data.projects.map((spec) => ({
    _id: stableId(`project:${spec.key}`),
    name: spec.name,
    slug: slugify(spec.name),
    client: spec.client,
    description: spec.description,
    technologies: (spec.technologies || []).map((slug) => ctx.ref.techBySlug(slug)._id),
    status: spec.status,
  }));
  const created = await Project.insertMany(docs);
  created.forEach((project, index) => ctx.projects.set(ctx.data.projects[index].key, project));
  ctx.counts.projects = created.length;
};

const createTickets = async (ctx) => {
  const { data, clock } = ctx;

  // Ticket.taskNumber is `immutable` with no auto-increment hook — the service
  // computes max+1 per workspace. The wipe leaves the collection empty, so a
  // simple per-workspace counter is enough.
  const taskNumbers = new Map();
  const nextTaskNumber = (workspaceKey) => {
    const next = (taskNumbers.get(workspaceKey) || 0) + 1;
    taskNumbers.set(workspaceKey, next);
    return next;
  };

  const commentDocs = [];
  const historyDocs = [];

  for (const spec of data.tickets) {
    const workspace = ctx.workspaces.get(spec.workspaceKey);
    const status = ctx.statuses.get(spec.workspaceKey).get(spec.statusSlug);
    const openedAt = clock.at(clock.workdaysAgo(spec.ageWorkdays), 10, 20);
    const creator = ctx.users.get(spec.creatorKey);

    const ticket = await Ticket.create({
      _id: stableId(`ticket:${spec.key}`),
      subject: spec.subject,
      description: spec.description,
      status: status._id,
      priority: spec.priority,
      storyPoints: spec.storyPoints ?? null,
      creator: creator._id,
      assignedTo: (spec.assigneeKeys || []).map((key) => ctx.users.get(key)._id),
      workspace: workspace._id,
      category: spec.categoryKey ? ctx.categories.get(spec.categoryKey)._id : null,
      taskNumber: nextTaskNumber(spec.workspaceKey),
      dueDate: spec.dueInWorkdays
        ? clock.startOfDay(clock.workdaysAhead(spec.dueInWorkdays))
        : null,
      totalTimeSpent: spec.timeSpent || 0,
      // Only tickets that have actually moved through the board carry these.
      inProgressAt: spec.timeSpent
        ? clock.at(clock.workdaysAgo(spec.ageWorkdays - 1), 11, 0)
        : null,
      doneAt: status.isDone
        ? clock.at(clock.workdaysAgo(Math.max(spec.ageWorkdays - 3, 0)), 16, 30)
        : null,
      messages: (spec.messages || []).map((message) => ({
        senderType: message.senderType,
        sender: message.senderKey ? ctx.users.get(message.senderKey)._id : undefined,
        text: message.text,
      })),
      ai: spec.ai || undefined,
    });
    ctx.tickets.set(spec.key, ticket);

    historyDocs.push({
      ticketId: ticket._id,
      entityType: 'ticket',
      entityId: ticket._id,
      action: 'created the ticket',
      userId: creator._id,
      // `userName` is required on History even though `userId` is not.
      userName: creator.fullname,
      timestamp: openedAt,
    });
    if (spec.statusSlug !== 'backlog') {
      historyDocs.push({
        ticketId: ticket._id,
        entityType: 'ticket',
        entityId: ticket._id,
        action: `moved the ticket to ${status.label}`,
        statusKey: status.slug,
        userId: ctx.users.get('mentor')._id,
        userName: ctx.users.get('mentor').fullname,
        timestamp: clock.at(clock.workdaysAgo(Math.max(spec.ageWorkdays - 2, 0)), 14, 5),
      });
    }

    (spec.comments || []).forEach((comment, index) => {
      commentDocs.push({
        _id: stableId(`comment:${spec.key}:${index}`),
        content: comment.text,
        ticket: ticket._id,
        author: ctx.users.get(comment.authorKey)._id,
        createdAt: clock.at(clock.workdaysAgo(Math.max(spec.ageWorkdays - index - 1, 0)), 13, 40),
      });
    });
  }

  await Comment.insertMany(commentDocs);
  await History.insertMany(historyDocs);
  ctx.counts.tickets = data.tickets.length;
  ctx.counts.comments = commentDocs.length;
  ctx.counts.history = historyDocs.length;
};

const createNotifications = async (ctx) => {
  const docs = ctx.data.notifications.map((spec, index) => {
    const ticket = ctx.tickets.get(spec.ticketKey);
    return {
      _id: stableId(`notification:${index}`),
      recipient: ctx.users.get(spec.recipientKey)._id,
      read: spec.read,
      type: spec.type,
      title: spec.title,
      body: spec.body,
      ticket: ticket._id,
      workspace: ticket.workspace,
      createdAt: ctx.clock.at(ctx.clock.workdaysAgo(spec.workdaysAgo), 15, 10),
    };
  });
  await Notification.insertMany(docs);
  ctx.counts.notifications = docs.length;
};

/**
 * Stand-ups for the last `days` working days. Who files on which day is a fixed
 * function of (internIndex, dayOffset) rather than random, so a re-seed
 * reproduces the same coverage gaps — the compliance view needs some days to be
 * incomplete to be worth showing.
 */
const createDailies = async (ctx) => {
  const { data, clock } = ctx;
  const docs = [];

  for (const spec of data.dailies) {
    const workspace = ctx.workspaces.get(spec.workspaceKey);

    // Only interns who are ACTIVE members of THIS workspace and whose user
    // account is itself active are eligible — helpers/workspaceInterns.js
    // filters on both, and it is the picker's denominator. An entry for anyone
    // else renders but can't be edited in the UI.
    const eligibleKeys = workspace.members
      .filter((member) => member.status === 'active')
      .map((member) => String(member.user))
      .map((userId) => {
        for (const [key, user] of ctx.users) {
          if (String(user._id) === userId && user.role === 'intern' && user.active) return key;
        }
        return null;
      })
      .filter(Boolean);

    for (let dayOffset = 0; dayOffset < spec.days; dayOffset += 1) {
      const dayKey = clock.workdaysAgo(dayOffset);
      const entries = [];

      eligibleKeys.forEach((internKey, index) => {
        const seed = index + dayOffset;
        if (seed % spec.skipEvery === spec.skipEvery - 1) return; // deliberate gap

        const blockers =
          seed % spec.blockerEvery === 0
            ? [
                {
                  text: spec.blockers[seed % spec.blockers.length],
                  linkedTicket:
                    ctx.tickets.get(spec.blockerTicketKeys[seed % spec.blockerTicketKeys.length])
                      ?._id || null,
                },
              ]
            : [];

        // The insights page renders `reportedAt` from the entry's own
        // createdAt. Left to mongoose that is the seed run's wall clock, so
        // every intern appears to have reported in the same minute — which
        // reads as fake on screen. Stagger them across the morning instead.
        const filedAt = clock.at(dayKey, 9 + ((index * 3) % 2), (index * 11) % 60);

        entries.push({
          member: ctx.users.get(internKey)._id,
          done: [spec.done[(index * 3 + dayOffset) % spec.done.length]],
          todo: [spec.todo[(index * 2 + dayOffset) % spec.todo.length]],
          blockers,
          createdAt: filedAt,
          updatedAt: filedAt,
        });
      });

      docs.push({
        _id: stableId(`daily:${spec.workspaceKey}:${dayKey}`),
        workspace: workspace._id,
        // Daily has a pre('validate') that normalizes to start-of-day; passing a
        // local midnight keeps the unique { workspace, date } index to one row/day.
        date: clock.startOfDay(dayKey),
        scribe: ctx.users.get(spec.scribeKey)._id,
        entries,
      });
    }
  }

  // create(), not insertMany(), so the pre('validate') date normalization runs.
  for (const doc of docs) await Daily.create(doc);
  ctx.counts.dailies = docs.length;
  ctx.counts.dailyEntries = docs.reduce((sum, doc) => sum + doc.entries.length, 0);
};

const run = async (ctx) => {
  await createProjects(ctx);
  await createTickets(ctx);
  await createNotifications(ctx);
  await createDailies(ctx);
};

module.exports = { run };
