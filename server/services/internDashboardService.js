const mongoose = require('mongoose');
const Daily = require('../models/Daily');
const Ticket = require('../models/Ticket');
const Workspace = require('../models/Workspace');
const evaluationService = require('./evaluationService');
const recommendationService = require('./recommendationService');
const { startOfDay, isDailyEditable, isWeekend } = require('../helpers/dailyRules');
const { resolveWorkloadBuckets } = require('../helpers/workloadBuckets');
const { officeDateKey } = require('../helpers/attendanceTime');
const { scoreTicketUrgency, compareByUrgency } = require('../helpers/ticketUrgency');
const { shouldSummarize, isSummaryFresh } = require('../helpers/standupNote');
const { resolveActiveWorkspaceId } = require('../helpers/workspaceAuthz');
const { httpError } = require('../helpers/httpError');

// How many tickets the board carries. The mockup renders one "start here" card
// plus four rows and a "+N more" link, so eight leaves headroom without paging
// the intern's whole backlog into the dashboard payload.
const TICKET_LIMIT = 8;

/**
 * The intern's own open tickets: the workload counts and the urgency-ordered
 * list, from one query.
 *
 * `assignedTo` is an array, so this is the intern's own load — a ticket shared
 * with someone else counts here in full, exactly as it does on the admin board.
 */
const loadTickets = async ({ workspaceId, userId, statuses }) => {
  const { buckets, byId, openStatusIds } = statuses;

  const tickets = openStatusIds.length
    ? await Ticket.find({
        workspace: workspaceId,
        assignedTo: userId,
        isArchived: { $ne: true },
        status: { $in: openStatusIds },
      })
        .select('subject description status priority dueDate taskNumber category updatedAt')
        .populate({ path: 'category', select: 'name' })
        .lean()
    : [];

  const countsBySlug = {};
  for (const ticket of tickets) {
    const slug = byId.get(String(ticket.status))?.slug;
    if (slug) countsBySlug[slug] = (countsBySlug[slug] || 0) + 1;
  }

  const todayKey = officeDateKey();
  const items = tickets
    .map((ticket) => {
      const status = byId.get(String(ticket.status));
      // Converted to an office-local day key here so the scorer stays free of
      // timezone knowledge — a ticket due "today" must not read as overdue
      // because the host process runs an hour behind Sarajevo.
      const dueDateKey = ticket.dueDate ? officeDateKey(ticket.dueDate) : null;
      const urgency = scoreTicketUrgency(
        { priority: ticket.priority, dueDateKey, isBlocked: status?.slug === 'blocked' },
        todayKey
      );
      return {
        id: ticket._id,
        taskNumber: ticket.taskNumber ?? null,
        subject: ticket.subject,
        description: ticket.description || '',
        priority: ticket.priority,
        dueDate: ticket.dueDate || null,
        dueDateKey,
        category: ticket.category?.name || '',
        status: status
          ? { id: status._id, slug: status.slug, label: status.label, color: status.color }
          : null,
        ...urgency,
      };
    })
    .sort(compareByUrgency);

  return {
    workload: {
      open: tickets.length,
      buckets: buckets.map(({ slug, label, color }) => ({
        slug,
        label,
        color,
        count: countsBySlug[slug] || 0,
      })),
    },
    tickets: { total: tickets.length, items: items.slice(0, TICKET_LIMIT) },
  };
};

/**
 * The intern's own entry in today's standup, if they have written one.
 *
 * Reads the `Daily` document directly rather than going through `dailyService`:
 * the intern-facing daily endpoints return the whole workspace's entries (which
 * is correct for the standup board), and this card only ever renders the
 * caller's own. Nobody else's text is loaded.
 */
const loadStandup = async ({ workspaceId, userId }) => {
  const now = new Date();
  const today = startOfDay(now);

  const daily = await Daily.findOne({ workspace: workspaceId, date: today })
    .select('date entries')
    .lean();

  const entry = daily?.entries?.find((item) => String(item.member) === String(userId)) || null;

  const base = {
    date: officeDateKey(now),
    isWeekend: isWeekend(today),
    editable: isDailyEditable(today, now),
    dailyId: daily?._id || null,
    written: false,
  };

  if (!entry) return base;

  const done = entry.done || [];
  const todo = entry.todo || [];
  const blockers = (entry.blockers || []).map((blocker) => ({
    text: blocker.text,
    linkedTicket: blocker.linkedTicket || null,
  }));

  // "N tickets mentioned" on the card. Counts distinct `#123` references across
  // the note plus any explicitly linked blocker ticket, so a ticket named twice
  // is still one mention.
  const mentioned = new Set();
  for (const line of [...done, ...todo, ...blockers.map((b) => b.text)]) {
    for (const match of String(line).matchAll(/#(\d+)/g)) mentioned.add(match[1]);
  }
  for (const blocker of blockers) {
    if (blocker.linkedTicket) mentioned.add(String(blocker.linkedTicket));
  }

  // A note too long for the card is shown summarised, expandable to the full
  // text. `aiSummary` is only sent when its hash still matches the note as it
  // stands — an edited note reads as "needs a new summary", never as the old one.
  // `needsSummary` is what tells the card to ask for one; the threshold itself
  // lives in `helpers/standupNote.js` so the read path and the generate endpoint
  // cannot disagree about which notes qualify.
  const isLong = shouldSummarize(entry);
  const summaryFresh = isLong && isSummaryFresh(entry);

  return {
    ...base,
    written: true,
    submittedAt: entry.createdAt || null,
    updatedAt: entry.updatedAt || null,
    done,
    todo,
    blockers,
    ticketsMentioned: mentioned.size,
    aiSummary: summaryFresh ? entry.aiSummary.text : null,
    needsSummary: isLong && !summaryFresh,
  };
};

/**
 * "My pipeline": the recommendation the intern is currently living through.
 *
 * The newest record wins — `listOwnRecommendations` sorts by `updatedAt` — because
 * the card shows one journey, and an intern with an earlier not-placed record
 * should see the live one, not the closed one. The rest ride along as `total` so
 * the card can link out.
 */
const loadPipeline = async (user) => {
  const recommendations = await recommendationService.listOwnRecommendations(user);
  return { current: recommendations[0] || null, total: recommendations.length };
};

/**
 * "My evaluations": the score history, newest period first, plus the movement
 * between the two most recent so the card can render the delta chip.
 */
const loadEvaluations = async (user) => {
  const evaluations = await evaluationService.listOwnEvaluations(user);
  const [latest, previous] = evaluations;

  const delta =
    latest?.averageScore != null && previous?.averageScore != null
      ? Math.round((latest.averageScore - previous.averageScore) * 10) / 10
      : null;

  return { latest: latest || null, delta, total: evaluations.length, items: evaluations };
};

/**
 * Everything the intern dashboard renders except attendance, which stays on
 * `GET /api/attendance/me` — that endpoint already returns the full record
 * history the hero's streak and week strip are derived from, and it is the one
 * the check-in mutations seed and invalidate. Duplicating it here would give the
 * hero two sources that disagree for a frame after checking in.
 *
 * Everything is scoped to the authenticated caller. There is deliberately no
 * `?internId=` / `?workspaceId=` override — unlike the admin board, which takes
 * its workspace from the query string, this endpoint's whole security model is
 * that the caller can only ever be the subject. See `.claude/docs/security.md`.
 */
const getInternDashboard = async (user) => {
  // `user.workspaceId` is only a pointer to the workspace last switched to — it
  // outlives the membership that made it valid, so it is verified against the
  // workspace's `members` list here and resolves to `null` once it no longer
  // holds. See `helpers/workspaceAuthz.js`.
  const workspaceId = await resolveActiveWorkspaceId({ user });

  // An intern between workspaces still gets their programme-level cards; only
  // the workspace-scoped half goes quiet. The page renders an explanation.
  const hasWorkspace = Boolean(workspaceId) && mongoose.Types.ObjectId.isValid(workspaceId);

  const workspace = hasWorkspace
    ? await Workspace.findOne({ _id: workspaceId, isArchived: { $ne: true } })
        .select('name')
        .lean()
    : null;

  // Verified here rather than trusted from the token: `user.workspaceId` is the
  // member's last active workspace and survives that workspace being archived,
  // which would otherwise return empty ticket and standup blocks that read as
  // "you have no work" instead of "this workspace is gone".
  if (hasWorkspace && !workspace) {
    throw httpError('Your active workspace no longer exists.', 404);
  }

  const statuses = workspace ? await resolveWorkloadBuckets(workspaceId) : null;

  const [ticketData, standup, pipeline, evaluations] = await Promise.all([
    statuses
      ? loadTickets({ workspaceId, userId: user._id, statuses })
      : { workload: { open: 0, buckets: [] }, tickets: { total: 0, items: [] } },
    workspace ? loadStandup({ workspaceId, userId: user._id }) : null,
    loadPipeline(user),
    loadEvaluations(user),
  ]);

  return {
    date: officeDateKey(),
    workspace: workspace ? { id: workspace._id, name: workspace.name } : null,
    workload: ticketData.workload,
    tickets: ticketData.tickets,
    standup,
    pipeline,
    evaluations,
  };
};

module.exports = { getInternDashboard };
