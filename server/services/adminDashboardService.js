const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const InternProfile = require('../models/InternProfile');
const Recommendation = require('../models/Recommendation');
const Ticket = require('../models/Ticket');
const Workspace = require('../models/Workspace');
const statusService = require('./statusService');
const { getActiveWorkspaceInterns } = require('../helpers/workspaceInterns');
const { computeMonthStats, averageAttendanceRate } = require('../helpers/attendanceStats');
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

// The workload segments, in render order. Fixed rather than derived from the
// workspace's status list so every row in the table has the same shape — a
// workspace that renamed or removed one still renders four segments. Labels and
// colors come from the workspace's own TicketStatus rows when they exist and
// fall back to the platform defaults, so a renamed status still reads correctly.
// `done` and `backlog` are deliberately excluded: this is open work in flight.
const WORKLOAD_SLUGS = ['to do', 'in progress', 'on staging', 'blocked'];

const RECENT_PLACEMENT_LIMIT = 3;
const RECENT_SPECIALIZATION_LIMIT = 3;

const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });

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
 * Resolves the four workload segments for a workspace. Returns both the display
 * list (slug/label/color, canonical order) and a slug-keyed map of status ids so
 * the ticket aggregation can group by status and be read back by slug.
 */
const resolveWorkloadBuckets = async (workspaceId) => {
  const statuses = await statusService.getWorkspaceStatuses(workspaceId);
  const bySlug = new Map(statuses.map((status) => [status.slug, status]));
  const defaultsBySlug = new Map(statusService.DEFAULT_STATUSES.map((s) => [s.slug, s]));

  const buckets = WORKLOAD_SLUGS.map((slug) => {
    const status = bySlug.get(slug);
    const fallback = defaultsBySlug.get(slug);
    return {
      slug,
      label: status?.label || fallback?.label || slug,
      color: status?.color || fallback?.color || '#64748b',
      statusId: status?._id || null,
    };
  });

  const statusIdToSlug = new Map(
    buckets.filter((b) => b.statusId).map((b) => [String(b.statusId), b.slug])
  );

  return { buckets, statusIdToSlug };
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
 * This month's attendance for the given intern profiles, keyed by profile id.
 * Cancelled rows are excluded — a cancelled day reads as absent (see the
 * Attendance model), so it must not count as a present record here either.
 */
const loadAttendance = async ({ profiles, monthKey }) => {
  const { start, end } = monthBounds(monthKey);
  const profileIds = profiles.map((p) => p._id);
  const rows = profileIds.length
    ? await Attendance.find({
        intern: { $in: profileIds },
        date: { $gte: start, $lte: end },
        status: { $ne: Attendance.CANCELLED },
      })
        .select('intern date')
        .lean()
    : [];

  const byProfile = new Map();
  for (const row of rows) {
    const key = String(row.intern);
    if (!byProfile.has(key)) byProfile.set(key, []);
    byProfile.get(key).push({ date: row.date });
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
      populate: { path: 'user', select: 'fullname' },
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
        intern: { fullname: placement.internProfile.user.fullname || '' },
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
    .populate({ path: 'user', select: 'fullname' })
    .populate({ path: 'declaredPosition', select: 'name' })
    .populate({ path: 'secondaryMentor', select: 'fullname' })
    .lean();

  return profiles
    .filter((profile) => profile.user)
    .map((profile) => ({
      id: profile._id,
      intern: { fullname: profile.user.fullname || '' },
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
    throw httpError(400, 'A valid workspaceId is required.');
  }

  const workspace = await Workspace.findOne({ _id: workspaceId, isArchived: { $ne: true } })
    .select('name')
    .lean();
  if (!workspace) throw httpError(404, 'Workspace not found.');

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

  const [workloadByUser, attendanceByProfile, recentPlacements, recentSpecializations] =
    await Promise.all([
      loadWorkloads({ workspaceId, internUserIds: inProgrammeUserIds, statusIdToSlug }),
      loadAttendance({ profiles, monthKey }),
      loadPlacements(),
      loadSpecializations(),
    ]);

  // `presentToday` drives the presence KPI and the absent list, and is dropped
  // again before the rows are returned — the interns table reports the month's
  // attendance rate, not today's single bit.
  const rows = inProgrammeUsers
    .map((user) => {
      const profile = profileByUser.get(String(user._id));
      const records = attendanceByProfile.get(String(profile._id)) || [];
      const { attendanceRate, presentDays, workingDays } = computeMonthStats(
        records,
        monthKey,
        profile.startDate
      );
      const counts = workloadByUser.get(String(user._id)) || {};

      return {
        id: user._id,
        fullname: user.fullname || '',
        email: user.email || '',
        position: profile.declaredPosition?.name || '',
        presentToday: records.some((r) => r.date === todayKey),
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
      absentToday: rows
        .filter((row) => !row.presentToday)
        .map(({ id, fullname, email, position }) => ({ id, fullname, email, position })),
    },
    lastPlacement: recentPlacements[0] || null,
    recentPlacements,
    recentSpecializations,
    workloadBuckets: buckets.map(({ slug, label, color }) => ({ slug, label, color })),
    interns: rows.map(({ presentToday, ...intern }) => intern),
  };
};

module.exports = { getAdminDashboard };
