const Ticket = require('../models/Ticket');
const TicketStatus = require('../models/TicketStatus');
const Workspace = require('../models/Workspace');
const SprintAISummary = require('../models/SprintAISummary');
const { userSelect } = require('../constants/userSelect');
const { httpError } = require('../helpers/httpError');
const {
  deriveSprintState,
  sprintProgress,
  emptyBuckets,
  idKey,
} = require('../helpers/sprintRules');
const {
  SUMMARY_TICKET_CAP,
  buildSprintTicketFacts,
  sprintSummarySourceHash,
  perUserProgress,
  carryOverSubjects,
} = require('../helpers/sprintSummaryData');
const { buildSprintSummaryPrompt } = require('../prompts/sprintSummaryPrompts');
const {
  requestGroqOutputText,
  extractJsonObject,
  createAiServiceError,
} = require('./groqAiClient');
const sprintService = require('./sprintService');

// How much of the model's answer to keep. A theme is now a "Headline - detail"
// line (see `prompts/sprintSummaryPrompts.js`), so the char cap has room for the
// detail clause; it is still a hard stop against a model that writes a paragraph.
const TEAM_THEMES_CAP = 8;
const PER_USER_THEMES_CAP = 5;
const THEME_CHAR_CAP = 220;

const cleanTheme = (value) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.;:,\s]+$/, '')
    .slice(0, THEME_CHAR_CAP);

const cleanThemes = (value, cap) =>
  Array.isArray(value) ? value.map(cleanTheme).filter(Boolean).slice(0, cap) : [];

// The model is only trusted to phrase things. Every id it echoes is checked
// against the members we actually sent, duplicates are dropped, and an entry
// with no usable theme is discarded — a per-person block with an empty list
// would render as a name and nothing else.
const normalizeAiPayload = (parsed, validIds) => {
  const valid = new Set(validIds.map(String));
  const team = parsed && typeof parsed === 'object' ? parsed.team : null;
  const perUserRaw = parsed && Array.isArray(parsed.perUser) ? parsed.perUser : [];

  const perUser = [];
  const seen = new Set();
  perUserRaw.forEach((row) => {
    const id = row && row.userId !== undefined ? String(row.userId) : '';
    if (!valid.has(id) || seen.has(id)) return;
    const themes = cleanThemes(row.themes, PER_USER_THEMES_CAP);
    if (!themes.length) return;
    perUser.push({ user: id, themes });
    seen.add(id);
  });

  return {
    team: { themes: cleanThemes(team?.themes, TEAM_THEMES_CAP) },
    perUser,
  };
};

// Tickets, statuses and active members for one sprint — the inputs both the read
// and the generate paths shape their output from. Tickets are fetched, not
// filtered, on `isArchived`: excluding them is a sprint rule and lives in the
// helper, once (mirrors `sprintService.withSprintMetrics`). Every query is
// workspace-scoped, and the sprint id was resolved within the workspace.
const loadSprintContext = async (sprint, workspaceId) => {
  const [statuses, tickets, workspace] = await Promise.all([
    TicketStatus.find({ workspace: workspaceId }).sort({ sortOrder: 1 }).lean(),
    Ticket.find({ workspace: workspaceId, sprint: sprint._id })
      .select('subject description taskNumber status storyPoints assignedTo isArchived')
      .sort({ doneAt: -1, updatedAt: -1 })
      .lean(),
    Workspace.findById(workspaceId).select('members').populate('members.user', userSelect()).lean(),
  ]);

  const members = (workspace?.members || [])
    .filter((member) => member.status === 'active' && member.user)
    .map((member) => member.user);

  return { statuses, tickets, members, ticketFacts: buildSprintTicketFacts(tickets, statuses) };
};

// Assemble the tab's payload from the tickets (numbers, always live) and the
// stored recap (prose, present only once generated). Per-person rows are every
// active member with at least one non-archived sprint ticket, most points done
// first.
const buildResponse = ({
  sprint,
  statuses,
  tickets,
  members,
  ticketFacts,
  aiDoc,
  today,
  progressByUser,
}) => {
  const teamProgress = sprintProgress(tickets, statuses);
  const { points: perUserPoints, counts: perUserCounts } =
    progressByUser ??
    perUserProgress(
      tickets,
      statuses,
      members.map((member) => member._id)
    );

  const aiThemesByUser = new Map(
    (aiDoc?.perUser || []).map((row) => [idKey(row.user), row.themes || []])
  );

  const perUser = members
    .map((member) => {
      const id = String(member._id);
      return {
        user: member,
        points: perUserPoints.get(id) || emptyBuckets(),
        tickets: perUserCounts.get(id) || emptyBuckets(),
        themes: aiThemesByUser.get(id) || [],
      };
    })
    .filter((row) => row.tickets.total > 0)
    .sort((a, b) => b.points.done - a.points.done || b.points.total - a.points.total);

  return {
    sprint: {
      _id: sprint._id,
      name: sprint.name,
      goal: sprint.goal || '',
      start: sprint.start,
      end: sprint.end,
      state: deriveSprintState(sprint, today),
    },
    team: {
      percent: teamProgress.percent,
      points: teamProgress.points,
      tickets: teamProgress.tickets,
      themes: aiDoc?.team?.themes || [],
      carryOver: carryOverSubjects(ticketFacts),
    },
    perUser,
    hasSummary: Boolean(aiDoc),
    stale: aiDoc ? aiDoc.sourceHash !== sprintSummarySourceHash(ticketFacts) : false,
    generatedAt: aiDoc?.generatedAt || null,
    generatedBy: aiDoc?.generatedBy || null,
  };
};

const withRecapPopulates = (query) =>
  query.populate('perUser.user', userSelect()).populate('generatedBy', userSelect()).lean();

// Upsert the one recap doc for this sprint, workspace-scoped to match the read
// path. First-time generation races on the unique `sprint` index when two people
// open a freshly-finished sprint's tab at once: the loser catches the duplicate
// key and returns the winner's just-written doc rather than letting a driver
// error surface as a 500 — both callers were summarising the same ticket state.
const upsertRecap = async ({ sprint, workspaceId, payload, ticketFacts, requesterId }) => {
  const filter = { sprint: sprint._id, workspace: workspaceId };
  const update = {
    ...filter,
    team: payload.team,
    perUser: payload.perUser,
    sourceHash: sprintSummarySourceHash(ticketFacts),
    model: String(process.env.GROQ_MODEL || ''),
    generatedAt: new Date(),
    generatedBy: requesterId,
  };

  try {
    return await withRecapPopulates(
      SprintAISummary.findOneAndUpdate(filter, update, {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      })
    );
  } catch (err) {
    if (err?.code !== 11000) throw err;
    const existing = await withRecapPopulates(SprintAISummary.findOne(filter));
    if (!existing) throw err;
    return existing;
  }
};

// The cached recap for one sprint, or the numbers alone with `hasSummary: false`
// when nothing has been generated. Workspace-scoped through
// `sprintService.assertSprintInWorkspace`, the same guard every sprint read uses.
// The recap lookup runs alongside the context load, not after it.
const getSprintSummary = async ({ sprintId, workspaceId, today = new Date() }) => {
  const sprint = await sprintService.assertSprintInWorkspace(sprintId, workspaceId);
  const [context, aiDoc] = await Promise.all([
    loadSprintContext(sprint, workspaceId),
    withRecapPopulates(SprintAISummary.findOne({ sprint: sprint._id, workspace: workspaceId })),
  ]);

  return buildResponse({ sprint, ...context, aiDoc, today });
};

// Generate (or regenerate) the recap. Any active workspace member may do this —
// authorization is the workspace scope, same as creating or editing a sprint
// (see `.claude/docs/security.md`). A sprint with nothing in the done bucket is
// summarised without a Groq call at all — the recap is legitimately empty, so it
// is persisted as such rather than erroring on every tab open. Otherwise it is
// one Groq call; on any AI failure the error carries a `statusCode` and the
// controller answers it, so nothing half-written is persisted.
const generateSprintSummary = async ({
  sprintId,
  workspaceId,
  requesterId,
  today = new Date(),
}) => {
  const sprint = await sprintService.assertSprintInWorkspace(sprintId, workspaceId);
  const context = await loadSprintContext(sprint, workspaceId);
  const { statuses, tickets, members, ticketFacts } = context;

  if (ticketFacts.length === 0) {
    throw httpError('This sprint has no tickets to summarise yet.', 422);
  }

  // Computed once here and handed to `buildResponse` so the per-person split is
  // not walked twice for one request.
  const progressByUser = perUserProgress(
    tickets,
    statuses,
    members.map((member) => member._id)
  );
  const doneTickets = sprintProgress(tickets, statuses).tickets.done;

  let payload = { team: { themes: [] }, perUser: [] };

  if (doneTickets > 0) {
    // Only members who hold a ticket in the sprint are named to the model; the
    // rest could never get a per-person block anyway.
    const activeMembers = members.filter(
      (member) => (progressByUser.counts.get(String(member._id))?.total ?? 0) > 0
    );

    const prompt = buildSprintSummaryPrompt({
      sprintName: sprint.name,
      ticketFacts: ticketFacts.slice(0, SUMMARY_TICKET_CAP),
      members: activeMembers.map((member) => ({
        id: String(member._id),
        name: member.fullname || 'Unknown',
      })),
    });

    const raw = await requestGroqOutputText({ prompt });
    const parsed = extractJsonObject(raw);
    if (!parsed) {
      throw createAiServiceError('The AI returned an unreadable summary. Please try again.', 502);
    }

    payload = normalizeAiPayload(
      parsed,
      activeMembers.map((member) => String(member._id))
    );
    if (!payload.team.themes.length && !payload.perUser.length) {
      throw createAiServiceError('The AI returned an empty summary. Please try again.', 502);
    }
  }

  const aiDoc = await upsertRecap({ sprint, workspaceId, payload, ticketFacts, requesterId });

  return buildResponse({ sprint, ...context, aiDoc, today, progressByUser });
};

module.exports = {
  getSprintSummary,
  generateSprintSummary,
};
