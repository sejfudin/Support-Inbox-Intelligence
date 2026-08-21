const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const InternProfile = require('../models/InternProfile');
const Recommendation = require('../models/Recommendation');
const Ticket = require('../models/Ticket');
const Workspace = require('../models/Workspace');
const { resolveWorkloadBuckets } = require('../helpers/workloadBuckets');
const { getActiveWorkspaceInterns } = require('../helpers/workspaceInterns');
const {
  splitRows,
  computeMonthStats,
  averageAttendanceRate,
  loadNonWorkingDays,
} = require('../helpers/attendanceStats');
const { httpError } = require('../helpers/httpError');
const { userSelect } = require('../constants/userSelect');
const {
  officeDateKey,
  officeMonthKey,
  monthBounds,
  checkInWindowState,
  CHECK_IN_WINDOW,
  CHECK_IN_WINDOW_LABEL,
} = require('../helpers/attendanceTime');

// Which interns the presence KPI and the workload table count: only interns still
// in the programme, since a placed or discontinued intern has no attendance or
// workload to report. Same list the attendance roster filters on — shared via the
// model so the two can't drift.
const { IN_PROGRAMME_STATUSES } = InternProfile;

const RECENT_PLACEMENT_LIMIT = 3;
const RECENT_SPECIALIZATION_LIMIT = 3;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Calendar day within the internship, 1-based: the start date itself is day 1.
// Null when either end is missing so the caller can omit the label entirely
// rather than render a misleading "day 1".
const dayOfCycle = (startDate, asOf) => {
  if (!startDate || !asOf) return null;
  const start = new Date(startDate).setHours(0, 0, 0, 0);
  const end = new Date(asOf).setHours(0, 0, 0, 0);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return Math.floor((end - start) / MS_PER_DAY) + 1;
};

const wholeDaysAgo = (date) => {
  if (!date) return null;
  const then = new Date(date).setHours(0, 0, 0, 0);
  const today = new Date().setHours(0, 0, 0, 0);
  if (Number.isNaN(then)) return null;
  return Math.max(0, Math.floor((today - then) / MS_PER_DAY));
};

/**
 * Open-ticket counts per intern per workload segment. `assignedTo` is an array,
 * so a ticket with two assignees counts once for each — the table reports each
 * intern's own load, not a partition of the workspace's tickets.
 */
const loadWorkloads = async ({ workspaceId, internUserIds, statusIdToSlug }) => {
  const statusIds = [...statusIdToSlug.keys()].map((id) => new mongoose.Types.ObjectId(id));
  if (statusIds.length === 0 || internUserIds.length === 0) return new Map();

  const rows = await Ticket.aggregate([
    {
      $match: {
        workspace: new mongoose.Types.ObjectId(workspaceId),
        isArchived: { $ne: true },
        status: { $in: statusIds },
      },
    },
    { $unwind: '$assignedTo' },
    { $match: { assignedTo: { $in: internUserIds.map((id) => new mongoose.Types.ObjectId(id)) } } },
    { $group: { _id: { user: '$assignedTo', status: '$status' }, count: { $sum: 1 } } },
  ]);

  const byUser = new Map();
  for (const row of rows) {
    const userKey = String(row._id.user);
    const slug = statusIdToSlug.get(String(row._id.status));
    if (!slug) continue;
    if (!byUser.has(userKey)) byUser.set(userKey, {});
    byUser.get(userKey)[slug] = row.count;
  }
  return byUser;
};

/**
 * This month's attendance for the given intern profiles, keyed by profile id, as
 * the `{ records, exemptDates }` split `computeMonthStats` expects.
 *
 * Rows are partitioned by the shared `splitRows` rather than by a local rule. This
 * function used to treat every non-cancelled row as present, which was right while
 * `remote` was the only extra status and became wrong the moment approved leave
 * could write a row: a fortnight of holiday would have read as a fortnight of
 * perfect attendance on the admin dashboard while reading correctly everywhere
 * else. One partition, every caller.
 */
const loadAttendance = async ({ profiles, monthKey }) => {
  const { start, end } = monthBounds(monthKey);
  const profileIds = profiles.map((p) => p._id);
  const rows = profileIds.length
    ? await Attendance.find({
        intern: { $in: profileIds },
        date: { $gte: start, $lte: end },
      })
        .select('intern date status checkedInAt')
        .lean()
    : [];

  const rowsByProfile = new Map();
  for (const row of rows) {
    const key = String(row.intern);
    if (!rowsByProfile.has(key)) rowsByProfile.set(key, []);
    rowsByProfile.get(key).push(row);
  }

  const byProfile = new Map();
  for (const [key, internRows] of rowsByProfile) {
    const { records, exemptDates } = splitRows(internRows);
    byProfile.set(key, { records, exemptDates });
  }
  return byProfile;
};

/**
 * The most recent placements across the WHOLE PLATFORM, most recently decided
 * first — deliberately not scoped to the selected workspace.
 *
 * A placement is a programme-level milestone, not a workspace event: the intern
 * leaves the programme when it happens, and leadership reads these two cards
 * ("Last intern placed" / "Recent placements") as "how is placement going for us",
 * not "for this board". Scoping them per workspace made the same placement appear
 * and disappear as the admin switched workspaces.
 *
 * Safe to leave unscoped because this endpoint is admin-only (see routes/admin.js)
 * and admins already have platform-wide read access. Nothing else on the payload
 * is global — presence, workload and the interns table all stay workspace-scoped.
 */
const loadPlacements = async () => {
  const placements = await Recommendation.find({ 'result.outcome': 'placed' })
    .sort({ 'result.decidedAt': -1, updatedAt: -1 })
    .limit(RECENT_PLACEMENT_LIMIT)
    .populate({
      path: 'internProfile',
      select: 'user startDate',
      populate: { path: 'user', select: userSelect() },
    })
    .populate({ path: 'project', select: 'name' })
    .populate({ path: 'position', select: 'name' })
    .lean();

  return placements
    .filter((placement) => placement.internProfile?.user)
    .map((placement) => {
      const decidedAt = placement.result?.decidedAt || placement.updatedAt || null;
      return {
        id: placement._id,
        intern: {
          fullname: placement.internProfile.user.fullname || '',
          avatarUrl: placement.internProfile.user.avatarUrl || null,
        },
        project: placement.project?.name || '',
        position: placement.position?.name || '',
        decidedAt,
        daysAgo: wholeDaysAgo(decidedAt),
        dayOfCycle: dayOfCycle(placement.internProfile.startDate, decidedAt),
      };
    });
};

/**
 * The most recently assigned specializations across the WHOLE PLATFORM, newest
 * first — unscoped for the same reason as `loadPlacements()` above: it is the
 * other half of the same card, a specialization is a programme-level decision
 * on the intern's profile (not a workspace event), and the endpoint is
 * admin-only. Scoping one half and not the other would make the pair
 * inconsistent as the admin switches workspaces.
 *
 * `specializationAssignedAt` is the marker of a specialization, not
 * `secondaryMentor` — a mentor value without the timestamp is a legacy
 * invite-time leftover and must not read as specialized (ADR 0002). The
 * confirmed position is `declaredPosition`: `applySpecialization` swaps the
 * confirmed one into that field, so it is always the specialization itself.
 */
const loadSpecializations = async () => {
  const profiles = await InternProfile.find({ specializationAssignedAt: { $ne: null } })
    .sort({ specializationAssignedAt: -1, _id: -1 })
    .limit(RECENT_SPECIALIZATION_LIMIT)
    .select('user declaredPosition secondaryMentor specializationAssignedAt')
    .populate({ path: 'user', select: userSelect() })
    .populate({ path: 'declaredPosition', select: 'name' })
    .populate({ path: 'secondaryMentor', select: 'fullname' })
    .lean();

  return profiles
    .filter((profile) => profile.user)
    .map((profile) => ({
      id: profile._id,
      intern: {
        fullname: profile.user.fullname || '',
        avatarUrl: profile.user.avatarUrl || null,
      },
      specialization: profile.declaredPosition?.name || '',
      secondaryMentor: profile.secondaryMentor?.fullname || '',
      assignedAt: profile.specializationAssignedAt,
    }));
};

/**
 * Everything the admin dashboard renders for one workspace, except the standup
 * card (which reuses `GET /api/dailies/admin/overview`) and the workspace picker
 * (`GET /api/workspaces/all`).
 *
 * Admin-only at the route, but the workspace is still verified to exist here:
 * `assertWorkspaceAccess` short-circuits for admins without touching the DB, so
 * a bogus id would otherwise return a convincing all-zeros payload.
 */
const getAdminDashboard = async ({ workspaceId }) => {
  if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
    throw httpError('A valid workspaceId is required.', 400);
  }

  const workspace = await Workspace.findOne({ _id: workspaceId, isArchived: { $ne: true } })
    .select('name')
    .lean();
  if (!workspace) throw httpError('Workspace not found.', 404);

  const monthKey = officeMonthKey();
  const todayKey = officeDateKey();
  const now = new Date();

  // The workload buckets are workspace reference data and do not depend on the
  // roster, so they resolve alongside it rather than after it — one fewer
  // round-trip of latency before the board can render.
  const [internUsers, { buckets, statusIdToSlug }] = await Promise.all([
    getActiveWorkspaceInterns(workspaceId),
    resolveWorkloadBuckets(workspaceId),
  ]);
  const internUserIds = internUsers.map((u) => u._id);

  // Only interns still in the programme carry attendance and workload. Profiles
  // are the join key for attendance (Attendance.intern → InternProfile).
  const profiles = internUserIds.length
    ? await InternProfile.find({
        user: { $in: internUserIds },
        status: { $in: IN_PROGRAMME_STATUSES },
      })
        .select('_id user startDate declaredPosition')
        .populate({ path: 'declaredPosition', select: 'name' })
        .lean()
    : [];

  const profileByUser = new Map(profiles.map((p) => [String(p.user), p]));
  const inProgrammeUsers = internUsers.filter((u) => profileByUser.has(String(u._id)));
  const inProgrammeUserIds = inProgrammeUsers.map((u) => u._id);

  const [workloadByUser, attendanceByProfile, recentPlacements, recentSpecializations, nonWorking] =
    await Promise.all([
      loadWorkloads({ workspaceId, internUserIds: inProgrammeUserIds, statusIdToSlug }),
      loadAttendance({ profiles, monthKey }),
      loadPlacements(),
      loadSpecializations(),
      loadNonWorkingDays(),
    ]);

  // `presentToday` and `awayToday` drive the presence KPI and the absent list, and
  // are dropped again before the rows are returned — the interns table reports the
  // month's attendance rate, not today's single bit.
  //
  // `awayToday` is approved leave: vacation, a religious holiday, or a sick day.
  // Such an intern is neither present nor absent, and putting them in the absent
  // list would send an admin chasing somebody whose day off that same admin signed.
  const rows = inProgrammeUsers
    .map((user) => {
      const profile = profileByUser.get(String(user._id));
      const { records, exemptDates } = attendanceByProfile.get(String(profile._id)) || {
        records: [],
        exemptDates: [],
      };
      const { attendanceRate, presentDays, workingDays } = computeMonthStats(
        records,
        monthKey,
        profile.startDate,
        profile.placedAt,
        nonWorking.keys,
        exemptDates
      );
      const counts = workloadByUser.get(String(user._id)) || {};

      return {
        id: user._id,
        fullname: user.fullname || '',
        email: user.email || '',
        avatarUrl: user.avatarUrl || null,
        position: profile.declaredPosition?.name || '',
        presentToday: records.some((r) => r.date === todayKey),
        awayToday: exemptDates.includes(todayKey),
        attendanceRate,
        presentDays,
        workingDays,
        workload: buckets.map((bucket) => ({
          slug: bucket.slug,
          label: bucket.label,
          color: bucket.color,
          count: counts[bucket.slug] || 0,
        })),
      };
    })
    .sort((a, b) => a.fullname.localeCompare(b.fullname));

  return {
    workspace: { name: workspace.name },
    presence: {
      presentToday: rows.filter((row) => row.presentToday).length,
      totalInterns: rows.length,
      monthAttendanceRate: averageAttendanceRate(rows.map((row) => row.attendanceRate)),
      checkInWindow: {
        label: CHECK_IN_WINDOW_LABEL,
        endHour: CHECK_IN_WINDOW.endHour,
        state: checkInWindowState(now),
      },
      awayToday: rows.filter((row) => row.awayToday).length,
      absentToday: rows
        .filter((row) => !row.presentToday && !row.awayToday)
        .map(({ id, fullname, email, position }) => ({ id, fullname, email, position })),
    },
    lastPlacement: recentPlacements[0] || null,
    recentPlacements,
    recentSpecializations,
    workloadBuckets: buckets.map(({ slug, label, color }) => ({ slug, label, color })),
    interns: rows.map(({ presentToday, awayToday, ...intern }) => intern),
  };
};

module.exports = { getAdminDashboard };
