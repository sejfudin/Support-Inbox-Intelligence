const Daily = require('../models/Daily');
const Ticket = require('../models/Ticket');
const { assertWorkspaceAccess } = require('../helpers/workspaceAuthz');
const { getActiveWorkspaceInterns } = require('../helpers/workspaceInterns');
const {
  isDailyEditable,
  deriveCounts,
  startOfDay,
  isWeekend,
  isValidMonthKey,
  currentMonthKey,
  monthBounds,
  formatDateKey,
  MS_PER_DAY,
} = require('../helpers/dailyRules');
const { emitDailyChanged } = require('../socket/events');

class DailyValidationError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'DailyValidationError';
    this.statusCode = statusCode;
  }
}

const ENTRY_MEMBER_POPULATE_SELECT = 'fullname email role';
const LINKED_TICKET_POPULATE_SELECT = 'taskNumber subject status workspace isArchived';
const LINKED_TICKET_STATUS_POPULATE_SELECT = 'slug label color';

const DAILY_POPULATE = [
  { path: 'scribe', select: ENTRY_MEMBER_POPULATE_SELECT },
  { path: 'entries.member', select: ENTRY_MEMBER_POPULATE_SELECT },
  {
    path: 'entries.blockers.linkedTicket',
    select: LINKED_TICKET_POPULATE_SELECT,
    populate: { path: 'status', select: LINKED_TICKET_STATUS_POPULATE_SELECT },
  },
];

const parseDateParam = (dateInput) => {
  if (!dateInput) {
    throw new DailyValidationError('A date is required.');
  }
  const parsed = new Date(dateInput);
  if (Number.isNaN(parsed.getTime())) {
    throw new DailyValidationError('Invalid date.');
  }
  return startOfDay(parsed);
};

// `getActiveWorkspaceInterns` (helpers/workspaceInterns.js) is the live denominator
// for the "Team covered" count and the pool the "add entry" picker offers from —
// shared with the admin dashboard, hence the helper.
const getActiveInternMemberIds = async (workspaceId) => {
  const interns = await getActiveWorkspaceInterns(workspaceId);
  return interns.map((intern) => String(intern._id));
};

const populateDaily = (query) => query.populate(DAILY_POPULATE);

const getDaily = async ({ workspaceId, date, user }) => {
  await assertWorkspaceAccess(workspaceId, user, 'Daily not found');

  const targetDate = parseDateParam(date);
  const daily = await populateDaily(Daily.findOne({ workspace: workspaceId, date: targetDate }));
  const activeInterns = await getActiveWorkspaceInterns(workspaceId);

  if (!daily) {
    return { daily: null, counts: deriveCounts([], activeInterns.length), activeInterns };
  }

  return {
    daily,
    counts: deriveCounts(daily.entries, activeInterns.length),
    activeInterns,
    isEditable: isDailyEditable(daily.date, new Date()),
  };
};

const getDailyHistory = async ({ workspaceId, user }) => {
  await assertWorkspaceAccess(workspaceId, user, 'Workspace not found');

  const [dailies, activeInternIds] = await Promise.all([
    Daily.find({ workspace: workspaceId }).select('date entries').sort({ date: -1 }).lean(),
    getActiveInternMemberIds(workspaceId),
  ]);

  return dailies.map((d) => ({
    date: d.date,
    counts: deriveCounts(d.entries, activeInternIds.length),
  }));
};

const startDaily = async ({ workspaceId, date, user }) => {
  await assertWorkspaceAccess(workspaceId, user, 'Workspace not found');

  const targetDate = parseDateParam(date);
  const today = startOfDay(new Date());
  if (targetDate.getTime() !== today.getTime()) {
    // A Daily is created lazily by the first person to open the tab that day.
    // Only today can be started — no back-filling past gaps, no future dailies.
    throw new DailyValidationError("A daily can only be started for today's date.");
  }

  let daily;
  try {
    daily = await Daily.create({
      workspace: workspaceId,
      date: targetDate,
      scribe: user._id,
      entries: [],
    });
  } catch (error) {
    if (error?.code === 11000) {
      // Two people hit "Start today's daily" at once — the loser of the race
      // simply returns the winner's record rather than erroring.
      daily = await Daily.findOne({ workspace: workspaceId, date: targetDate });
      if (!daily) throw error;
    } else {
      throw error;
    }
  }

  const populated = await populateDaily(Daily.findById(daily._id));
  emitDailyChanged(workspaceId);
  return populated;
};

const loadDailyOrThrow = async (dailyId, user) => {
  const daily = await Daily.findById(dailyId);
  if (!daily) {
    throw new DailyValidationError('Daily not found', 404);
  }
  await assertWorkspaceAccess(daily.workspace, user, 'Daily not found');
  return daily;
};

const assertEditable = (daily) => {
  if (!isDailyEditable(daily.date, new Date())) {
    throw new DailyValidationError('This daily is outside its edit window and is read-only.');
  }
};

const assertActiveInternMember = async (workspaceId, memberId) => {
  const activeInternIds = await getActiveInternMemberIds(workspaceId);
  if (!activeInternIds.includes(String(memberId))) {
    throw new DailyValidationError('Member must be an active intern in this workspace.');
  }
};

const normalizeItemList = (items) =>
  Array.isArray(items) ? items.map((item) => String(item ?? '').trim()).filter(Boolean) : [];

const normalizeBlockers = async (blockers, workspaceId) => {
  if (!Array.isArray(blockers)) return [];

  const normalized = [];
  for (const blocker of blockers) {
    const text = String(blocker?.text ?? '').trim();
    if (!text) continue;

    let linkedTicket = null;
    if (blocker?.linkedTicket) {
      const ticket = await Ticket.findById(blocker.linkedTicket).select('workspace').lean();
      if (!ticket || String(ticket.workspace) !== String(workspaceId)) {
        throw new DailyValidationError('A blocker can only link to a ticket in this workspace.');
      }
      linkedTicket = ticket._id;
    }

    normalized.push({ text, linkedTicket });
  }

  return normalized;
};

const addEntry = async ({ dailyId, memberId, done, todo, blockers, user }) => {
  const daily = await loadDailyOrThrow(dailyId, user);
  assertEditable(daily);

  if (!memberId) {
    throw new DailyValidationError('An intern must be selected.');
  }

  await assertActiveInternMember(daily.workspace, memberId);

  const alreadyHasEntry = daily.entries.some((entry) => String(entry.member) === String(memberId));
  if (alreadyHasEntry) {
    throw new DailyValidationError('This intern already has an entry for this daily.');
  }

  const normalizedBlockers = await normalizeBlockers(blockers, daily.workspace);

  daily.entries.push({
    member: memberId,
    done: normalizeItemList(done),
    todo: normalizeItemList(todo),
    blockers: normalizedBlockers,
  });
  daily.scribe = user._id;
  await daily.save();

  const populated = await populateDaily(Daily.findById(daily._id));
  emitDailyChanged(daily.workspace);
  return populated;
};

const updateEntry = async ({ dailyId, entryId, done, todo, blockers, user }) => {
  const daily = await loadDailyOrThrow(dailyId, user);
  assertEditable(daily);

  const entry = daily.entries.id(entryId);
  if (!entry) {
    throw new DailyValidationError('Entry not found', 404);
  }

  const normalizedBlockers = await normalizeBlockers(blockers, daily.workspace);

  entry.done = normalizeItemList(done);
  entry.todo = normalizeItemList(todo);
  entry.blockers = normalizedBlockers;
  daily.scribe = user._id;
  await daily.save();

  const populated = await populateDaily(Daily.findById(daily._id));
  emitDailyChanged(daily.workspace);
  return populated;
};

const removeEntry = async ({ dailyId, entryId, user }) => {
  const daily = await loadDailyOrThrow(dailyId, user);
  assertEditable(daily);

  const entry = daily.entries.id(entryId);
  if (!entry) {
    throw new DailyValidationError('Entry not found', 404);
  }

  entry.deleteOne();
  daily.scribe = user._id;
  await daily.save();

  const populated = await populateDaily(Daily.findById(daily._id));
  emitDailyChanged(daily.workspace);
  return populated;
};

const buildMemberSummary = (intern) => ({
  id: String(intern._id),
  fullname: intern.fullname || '',
  email: intern.email || '',
});

/**
 * Admin-only, one workspace + one calendar month: today's reported/not-reported
 * breakdown plus a per-intern day-by-day coverage grid. Derived from a single
 * bounded Daily query (no per-day fetch) and the same active-intern roster the
 * intern-facing header already uses as its "covered" denominator.
 */
const getWorkspaceDailyOverview = async ({ workspaceId, month, user }) => {
  if (!workspaceId) {
    throw new DailyValidationError('A workspace is required.');
  }
  await assertWorkspaceAccess(workspaceId, user, 'Workspace not found');

  const monthKey = isValidMonthKey(month) ? month : currentMonthKey();
  const { start, end } = monthBounds(monthKey);
  const today = startOfDay(new Date());
  const rangeEnd = end.getTime() < today.getTime() ? end : today; // never show future days as missed

  const [dailies, interns] = await Promise.all([
    Daily.find({ workspace: workspaceId, date: { $gte: start, $lte: end } })
      .select('date entries')
      .lean(),
    getActiveWorkspaceInterns(workspaceId),
  ]);

  const dailyByTime = new Map(dailies.map((d) => [startOfDay(d.date).getTime(), d]));
  const todayDaily = dailyByTime.get(today.getTime());

  const reported = [];
  const missing = [];
  for (const intern of interns) {
    const entry = todayDaily?.entries.find((e) => String(e.member) === String(intern._id));
    entry
      ? reported.push({ ...buildMemberSummary(intern), reportedAt: entry.createdAt })
      : missing.push(buildMemberSummary(intern));
  }

  const days = [];
  let cursor = new Date(start);
  while (cursor.getTime() <= rangeEnd.getTime()) {
    days.push({
      date: new Date(cursor),
      weekend: isWeekend(cursor),
      daily: dailyByTime.get(cursor.getTime()),
    });
    // Fixed 24h step from the business-timezone start, not host-local
    // .setDate()/.getDate() — those walk host-local calendar days, which
    // drift the whole grid back a day on a host in a different timezone
    // from Sarajevo (e.g. dev's deployed container vs. local).
    cursor = new Date(cursor.getTime() + MS_PER_DAY);
  }

  const people = interns.map((intern) => {
    const cells = {};
    let reportedCount = 0;
    let eligibleWorkingDays = 0;
    for (const day of days) {
      if (day.weekend) continue;
      eligibleWorkingDays += 1;
      const hasEntry = Boolean(
        day.daily?.entries.some((e) => String(e.member) === String(intern._id))
      );
      cells[formatDateKey(day.date)] = hasEntry ? 'reported' : 'missed';
      if (hasEntry) reportedCount += 1;
    }
    return {
      ...buildMemberSummary(intern),
      cells,
      reportedCount,
      eligibleWorkingDays,
      rate: eligibleWorkingDays > 0 ? Math.round((reportedCount / eligibleWorkingDays) * 100) : 0,
    };
  });

  const monthReported = people.reduce((sum, p) => sum + p.reportedCount, 0);
  const monthEligible = people.reduce((sum, p) => sum + p.eligibleWorkingDays, 0);

  return {
    month: monthKey,
    today: { date: formatDateKey(today), isWeekend: isWeekend(today), reported, missing },
    stats: {
      reportedToday: reported.length,
      notReportedToday: missing.length,
      totalInterns: interns.length,
      coverageRate: monthEligible > 0 ? Math.round((monthReported / monthEligible) * 100) : 0,
      openBlockers: deriveCounts(todayDaily?.entries ?? [], interns.length).blockers,
    },
    coverage: {
      days: days.map((day) => ({ date: formatDateKey(day.date), weekend: day.weekend })),
      people,
    },
  };
};

/**
 * One member's standup for one date (admin-only) — powers the coverage-grid /
 * today-card click-through popup. The caller already has the member's name
 * from the overview data it clicked on, so this returns only the entry itself.
 */
const getMemberDailyEntry = async ({ workspaceId, memberId, date, user }) => {
  if (!workspaceId) {
    throw new DailyValidationError('A workspace is required.');
  }
  if (!memberId) {
    throw new DailyValidationError('A member is required.');
  }
  await assertWorkspaceAccess(workspaceId, user, 'Workspace not found');

  const targetDate = parseDateParam(date);
  const daily = await populateDaily(Daily.findOne({ workspace: workspaceId, date: targetDate }));
  const entry = daily?.entries.find((e) => String(e.member?._id ?? e.member) === String(memberId));

  if (!entry) {
    return { reported: false };
  }

  return {
    reported: true,
    reportedAt: entry.createdAt,
    done: entry.done,
    todo: entry.todo,
    blockers: entry.blockers,
  };
};

module.exports = {
  DailyValidationError,
  getDaily,
  getDailyHistory,
  startDaily,
  addEntry,
  updateEntry,
  removeEntry,
  getWorkspaceDailyOverview,
  getMemberDailyEntry,
};
