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
const internNotificationService = require('./internNotificationService');

/**
 * A 10:30 office-time nudge: "you haven't checked in / filed today's standup
 * yet." Nothing fires for an intern who's already done both.
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

const REMINDER_HOUR = 10;
const REMINDER_MINUTE_WINDOW = [30, 34]; // inclusive — matched against a 5-minute poll
const POLL_INTERVAL_MS = 5 * 60 * 1000;

// In-memory only: a same-day server restart landing inside the trigger window
// could re-fire once. Acceptable for a reminder (not data-corrupting) and
// avoids a persisted job-lock for what is otherwise a single, small check.
let lastRunDateKey = null;

const maybeRunScheduledCheck = async () => {
  const now = new Date();
  if (isOfficeWeekend(now)) return;
  if (officeHour(now) !== REMINDER_HOUR) return;
  const minute = officeMinute(now);
  if (minute < REMINDER_MINUTE_WINDOW[0] || minute > REMINDER_MINUTE_WINDOW[1]) return;

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

module.exports = { runDailyReminderCheck, startDailyReminderScheduler };
