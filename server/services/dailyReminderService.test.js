/**
 * Covers the window rule and the single-intern on-arrival check. The cohort
 * sweep (`runDailyReminderCheck`) is not exercised here — it fans out over every
 * profile and workspace, which is a DB-shaped test rather than a unit one.
 */

jest.mock('../models/InternProfile', () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  IN_PROGRAMME_STATUSES: ['active'],
}));
jest.mock('../models/Attendance', () => ({ findOne: jest.fn(), find: jest.fn() }));
jest.mock('../models/NonWorkingDay', () => ({ findOne: jest.fn() }));
jest.mock('../models/Workspace', () => ({ find: jest.fn() }));
jest.mock('../models/Daily', () => ({ findOne: jest.fn() }));
jest.mock('../models/User', () => ({ findOne: jest.fn(), find: jest.fn() }));
jest.mock('../helpers/attendanceStats', () => ({ isExemptOn: jest.fn(() => false) }));
jest.mock('../helpers/workspaceInterns', () => ({ getActiveWorkspaceInterns: jest.fn() }));
jest.mock('./internNotificationService', () => ({
  notifyDailyReminder: jest.fn(() => Promise.resolve({ delivered: true, redelivered: false })),
}));

const InternProfile = require('../models/InternProfile');
const Attendance = require('../models/Attendance');
const NonWorkingDay = require('../models/NonWorkingDay');
const Workspace = require('../models/Workspace');
const Daily = require('../models/Daily');
const User = require('../models/User');
const { isExemptOn } = require('../helpers/attendanceStats');
const { notifyDailyReminder } = require('./internNotificationService');
const {
  REMINDER_WINDOW,
  isWithinReminderWindow,
  runDailyReminderCheckForUser,
} = require('./dailyReminderService');

// Instants are derived from REMINDER_WINDOW rather than written out, so shifting
// the window does not turn these into failures about the wrong thing.
// Europe/Sarajevo is UTC+2 through August.
const OFFICE_UTC_OFFSET = 2;
const officeInstant = (day, hour, minute) =>
  new Date(Date.UTC(2026, 7, day, hour - OFFICE_UTC_OFFSET, minute));

const { hour: H, fromMinute: M } = REMINDER_WINDOW;
const IN_WINDOW = officeInstant(20, H, M + 5); // a Thursday, inside the window
const BEFORE_WINDOW = officeInstant(20, H, M - 1);
const AFTER_WINDOW = officeInstant(20, H + 1, 0);
const SATURDAY = officeInstant(22, H, M + 5);

/** Mirrors `Model.findOne(...).select(...).lean()`. */
const chain = (value) => ({ select: () => ({ lean: () => Promise.resolve(value) }) });

const activeIntern = () => {
  User.findOne.mockReturnValue(chain({ _id: 'user-1' }));
  InternProfile.findOne.mockReturnValue(
    chain({ _id: 'profile-1', status: 'active', placedAt: null })
  );
};

describe('isWithinReminderWindow', () => {
  it('is open inside the window on a weekday', () => {
    expect(isWithinReminderWindow(IN_WINDOW)).toBe(true);
  });

  it('is shut before the opening minute and once the next hour arrives', () => {
    expect(isWithinReminderWindow(BEFORE_WINDOW)).toBe(false);
    expect(isWithinReminderWindow(AFTER_WINDOW)).toBe(false);
  });

  it('is shut at the weekend', () => {
    expect(isWithinReminderWindow(SATURDAY)).toBe(false);
  });
});

describe('runDailyReminderCheckForUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    isExemptOn.mockReturnValue(false);
    notifyDailyReminder.mockResolvedValue({ delivered: true, redelivered: false });
    NonWorkingDay.findOne.mockReturnValue(chain(null));
    Workspace.find.mockReturnValue(chain([]));
  });

  it('does nothing outside the window, without touching the database', async () => {
    await expect(runDailyReminderCheckForUser('user-1', BEFORE_WINDOW)).resolves.toEqual({
      skipped: 'outside-window',
    });
    expect(NonWorkingDay.findOne).not.toHaveBeenCalled();
    expect(notifyDailyReminder).not.toHaveBeenCalled();
  });

  it('does nothing on a non-working day', async () => {
    NonWorkingDay.findOne.mockReturnValue(chain({ _id: 'holiday' }));

    await expect(runDailyReminderCheckForUser('user-1', IN_WINDOW)).resolves.toEqual({
      skipped: 'non-working-day',
    });
    expect(notifyDailyReminder).not.toHaveBeenCalled();
  });

  it('does nothing for an account that is not an active intern', async () => {
    User.findOne.mockReturnValue(chain(null));

    await expect(runDailyReminderCheckForUser('user-1', IN_WINDOW)).resolves.toEqual({
      skipped: 'not-an-active-intern',
    });
    expect(notifyDailyReminder).not.toHaveBeenCalled();
  });

  it('nudges an intern who has not checked in', async () => {
    activeIntern();
    Attendance.findOne.mockReturnValue(chain(null));

    await expect(runDailyReminderCheckForUser('user-1', IN_WINDOW)).resolves.toEqual({
      notified: 1,
      redelivered: false,
      missingAttendance: true,
      missingDaily: false,
    });
    expect(notifyDailyReminder).toHaveBeenCalledWith({
      internUserId: 'user-1',
      internProfileId: 'profile-1',
      missingAttendance: true,
      missingDaily: false,
      dateKey: '2026-08-20',
      redeliver: true,
    });
  });

  it('stays quiet once the intern has checked in and owes no standup note', async () => {
    activeIntern();
    Attendance.findOne.mockReturnValue(chain({ _id: 'attendance-1' }));

    await expect(runDailyReminderCheckForUser('user-1', IN_WINDOW)).resolves.toEqual({
      skipped: 'nothing-due',
    });
    expect(notifyDailyReminder).not.toHaveBeenCalled();
  });

  it('nudges for a missing standup note even when attendance is done', async () => {
    activeIntern();
    Attendance.findOne.mockReturnValue(chain({ _id: 'attendance-1' }));
    Workspace.find.mockReturnValue(chain([{ _id: 'workspace-1' }]));
    Daily.findOne.mockReturnValue(chain({ entries: [{ member: 'someone-else' }] }));

    await expect(runDailyReminderCheckForUser('user-1', IN_WINDOW)).resolves.toEqual({
      notified: 1,
      redelivered: false,
      missingAttendance: false,
      missingDaily: true,
    });
  });

  it('reports a re-delivery of the row the sweep already wrote', async () => {
    activeIntern();
    Attendance.findOne.mockReturnValue(chain(null));
    notifyDailyReminder.mockResolvedValue({ delivered: true, redelivered: true });

    await expect(runDailyReminderCheckForUser('user-1', IN_WINDOW)).resolves.toEqual({
      notified: 1,
      redelivered: true,
      missingAttendance: true,
      missingDaily: false,
    });
  });

  it("reports nothing delivered when the reader has already read today's reminder", async () => {
    activeIntern();
    Attendance.findOne.mockReturnValue(chain(null));
    notifyDailyReminder.mockResolvedValue({ skipped: 'already-read' });

    await expect(runDailyReminderCheckForUser('user-1', IN_WINDOW)).resolves.toEqual({
      skipped: 'already-read',
    });
  });

  it('owes no attendance while the intern is placed on a project', async () => {
    activeIntern();
    isExemptOn.mockReturnValue(true);

    await expect(runDailyReminderCheckForUser('user-1', IN_WINDOW)).resolves.toEqual({
      skipped: 'nothing-due',
    });
    expect(Attendance.findOne).not.toHaveBeenCalled();
  });
});
