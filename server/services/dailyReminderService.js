const InternProfile = require('../models/InternProfile');
const { IN_PROGRAMME_STATUSES } = require('../models/InternProfile');
const Attendance = require('../models/Attendance');
const NonWorkingDay = require('../models/NonWorkingDay');
const Workspace = require('../models/Workspace');
const Daily = require('../models/Daily');
const User = require('../models/User');
const {
  officeDateKey,
  officeHour,
  officeMinute,
  isOfficeWeekend,
} = require('../helpers/attendanceTime');
const { isExemptOn } = require('../helpers/attendanceStats');
const { startOfDay } = require('../helpers/dailyRules');
const { getActiveWorkspaceInterns } = require('../helpers/workspaceInterns');
const { ROLES } = require('../constants/roles');
const internNotificationService = require('./internNotificationService');

/**
 * The 10:30–11:00 office-time nudge: "you haven't checked in / filed today's
 * standup yet." Nothing fires for an intern who's already done both.
 *
 * This is the cohort sweep. `runDailyReminderCheckForUser` below is the same
 * check for one intern, run when they open the app inside the window.
 *
 * Two independently-scoped candidate sets, each mirroring the scoping an
 * existing read path already uses for that domain, rather than inventing a
 * unified rule:
 *  - Attendance: `InternProfile.status ∈ IN_PROGRAMME_STATUSES`, same as the
 *    roster (`attendanceService.js#getRoster`), minus anyone exempt today
 *    (`isExemptOn` — a placed intern owes nothing).
 *  - Daily: `getActiveWorkspaceInterns` per active workspace — the same
 *    roster `dailyService.js#getWorkspaceDailyOverview` already uses, which
 *    does NOT filter by InternProfile status (a placed intern still counted
 *    as an active workspace member is still expected to report there today,
 *    consistent with that existing "known gap").
 */
const runDailyReminderCheck = async (now = new Date()) => {
  if (isOfficeWeekend(now)) return { skipped: 'weekend' };

  const todayKey = officeDateKey(now);
  const nonWorking = await NonWorkingDay.findOne({ date: todayKey }).select('_id').lean();
  if (nonWorking) return { skipped: 'non-working-day' };

  // userId(string) -> { internProfileId, missingAttendance, missingDaily }
  const flagsByUser = new Map();
  const touch = (userId, internProfileId = null) => {
    const key = String(userId);
    let entry = flagsByUser.get(key);
    if (!entry) {
      entry = { internProfileId, missingAttendance: false, missingDaily: false };
      flagsByUser.set(key, entry);
    } else if (internProfileId && !entry.internProfileId) {
      entry.internProfileId = internProfileId;
    }
    return entry;
  };

  const programmeProfiles = await InternProfile.find({ status: { $in: IN_PROGRAMME_STATUSES } })
    .select('_id user placedAt')
    .lean();
  const activeUserIds = new Set(
    (
      await User.find({
        _id: { $in: programmeProfiles.map((profile) => profile.user) },
        active: true,
        status: 'active',
      })
        .select('_id')
        .lean()
    ).map((user) => String(user._id))
  );
  const profiles = programmeProfiles.filter((profile) => activeUserIds.has(String(profile.user)));
  const profileIdByUser = new Map(profiles.map((p) => [String(p.user), p._id]));

  const dueProfiles = profiles.filter((p) => !isExemptOn(p.placedAt, todayKey));
  if (dueProfiles.length > 0) {
    const checkedInIds = new Set(
      (
        await Attendance.find({
          date: todayKey,
          status: 'present',
          intern: { $in: dueProfiles.map((p) => p._id) },
        })
          .select('intern')
          .lean()
      ).map((a) => String(a.intern))
    );
    for (const profile of dueProfiles) {
      if (!checkedInIds.has(String(profile._id))) {
        touch(profile.user, profile._id).missingAttendance = true;
      }
    }
  }

  const workspaces = await Workspace.find({ isArchived: false }).select('_id').lean();
  const today = startOfDay(now);
  for (const workspace of workspaces) {
    const [members, todayDaily] = await Promise.all([
      getActiveWorkspaceInterns(workspace._id),
      Daily.findOne({ workspace: workspace._id, date: today }).select('entries').lean(),
    ]);
    for (const member of members) {
      const hasEntry = todayDaily?.entries?.some((e) => String(e.member) === String(member._id));
      if (!hasEntry) {
        touch(member._id, profileIdByUser.get(String(member._id)) ?? null).missingDaily = true;
      }
    }
  }

  let notified = 0;
  for (const [userId, flags] of flagsByUser) {
    if (!flags.missingAttendance && !flags.missingDaily) continue;
    internNotificationService.notifyDailyReminder({
      internUserId: userId,
      internProfileId: flags.internProfileId,
      missingAttendance: flags.missingAttendance,
      missingDaily: flags.missingDaily,
      dateKey: todayKey,
    });
    notified += 1;
  }

  return { candidates: flagsByUser.size, notified };
};

/**
 * The nudge window in office time: 10:30 up to (but not including) 11:00 — the
 * last half hour of the 07:00–11:00 check-in window.
 *
 * Both entry points share this one window:
 *  - The scheduler sweeps every candidate on its first tick inside the window,
 *    so an intern who never opens the app still gets the bell entry.
 *  - `runDailyReminderCheckForUser` re-checks one intern on arrival, so someone
 *    who signs in at 10:47 is nudged then instead of missing the sweep.
 *
 * `Notification.dedupeKey` is what makes the two safe together: whichever runs
 * first writes the row, and the other's insert is swallowed as a duplicate
 * (`internNotificationService.dispatch`).
 */
const REMINDER_WINDOW = Object.freeze({ hour: 10, fromMinute: 30 });
const POLL_INTERVAL_MS = 5 * 60 * 1000;

/** Whether `now` sits inside the nudge window (weekday, 10:30–10:59 office time). */
const isWithinReminderWindow = (now = new Date()) => {
  if (isOfficeWeekend(now)) return false;
  if (officeHour(now) !== REMINDER_WINDOW.hour) return false;
  return officeMinute(now) >= REMINDER_WINDOW.fromMinute;
};

/**
 * The same check as `runDailyReminderCheck`, narrowed to one intern, for the
 * on-arrival path. Scoped entirely by `userId` — it reads that user's own
 * profile, attendance and workspace memberships and nothing else.
 *
 * Returns `{ skipped }` when nothing was due, or `{ notified: 1 }`. Awaits the
 * notify so the caller can tell the client whether a banner is coming.
 */
const runDailyReminderCheckForUser = async (userId, now = new Date()) => {
  if (!isWithinReminderWindow(now)) return { skipped: 'outside-window' };

  const todayKey = officeDateKey(now);
  const nonWorking = await NonWorkingDay.findOne({ date: todayKey }).select('_id').lean();
  if (nonWorking) return { skipped: 'non-working-day' };

  // Mirrors the role/active filter `getActiveWorkspaceInterns` applies: only an
  // active intern account is ever reminded.
  const user = await User.findOne({
    _id: userId,
    role: ROLES.INTERN,
    active: true,
    status: 'active',
  })
    .select('_id')
    .lean();
  if (!user) return { skipped: 'not-an-active-intern' };

  const profile = await InternProfile.findOne({ user: userId })
    .select('_id status placedAt')
    .lean();

  let missingAttendance = false;
  if (
    profile &&
    IN_PROGRAMME_STATUSES.includes(profile.status) &&
    !isExemptOn(profile.placedAt, todayKey)
  ) {
    const checkedIn = await Attendance.findOne({
      date: todayKey,
      status: 'present',
      intern: profile._id,
    })
      .select('_id')
      .lean();
    missingAttendance = !checkedIn;
  }

  // Membership lives on `Workspace.members`, never on the user — see
  // helpers/workspaceInterns.js for why `User.workspaceId` is not a membership
  // record. One missing entry in any workspace is enough to nudge.
  const workspaces = await Workspace.find({
    isArchived: false,
    members: { $elemMatch: { user: userId, status: 'active' } },
  })
    .select('_id')
    .lean();
  const today = startOfDay(now);
  let missingDaily = false;
  for (const workspace of workspaces) {
    const todayDaily = await Daily.findOne({ workspace: workspace._id, date: today })
      .select('entries')
      .lean();
    const hasEntry = todayDaily?.entries?.some((e) => String(e.member) === String(userId));
    if (!hasEntry) {
      missingDaily = true;
      break;
    }
  }

  if (!missingAttendance && !missingDaily) return { skipped: 'nothing-due' };

  // `redeliver` is the whole point of this path. The sweep has almost certainly
  // written today's row already — it writes one for every due intern at 10:30,
  // signed in or not — so without it every arrival after the sweep hits the
  // dedupe key and the reader is never shown anything.
  const result = await internNotificationService.notifyDailyReminder({
    internUserId: userId,
    internProfileId: profile?._id ?? null,
    missingAttendance,
    missingDaily,
    dateKey: todayKey,
    redeliver: true,
  });

  if (!result?.delivered) return { skipped: result?.skipped ?? 'not-delivered' };

  return {
    notified: 1,
    redelivered: Boolean(result.redelivered),
    missingAttendance,
    missingDaily,
  };
};

// In-memory only: a same-day server restart landing inside the trigger window
// could re-fire once. Acceptable for a reminder (not data-corrupting) and
// avoids a persisted job-lock for what is otherwise a single, small check.
let lastRunDateKey = null;

const maybeRunScheduledCheck = async () => {
  const now = new Date();
  if (!isWithinReminderWindow(now)) return;

  const todayKey = officeDateKey(now);
  if (lastRunDateKey === todayKey) return;
  lastRunDateKey = todayKey; // set before awaiting so an overlapping tick can't double-fire

  try {
    await runDailyReminderCheck(now);
  } catch (err) {
    console.error('[dailyReminderService] scheduled run failed:', err.message);
  }
};

const startDailyReminderScheduler = () => {
  setInterval(maybeRunScheduledCheck, POLL_INTERVAL_MS);
};

module.exports = {
  REMINDER_WINDOW,
  runDailyReminderCheck,
  runDailyReminderCheckForUser,
  isWithinReminderWindow,
  startDailyReminderScheduler,
};
