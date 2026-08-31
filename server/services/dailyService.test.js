// A blocker is text, optionally pointing at a ticket. This file pins the "text"
// half of that rule at the service boundary: a blocker submitted without text is
// rejected, never quietly dropped.
//
// It used to be dropped. `normalizeBlockers` skipped any blocker whose text was
// empty, so a blocker carrying only a linked ticket left no trace — the entry
// saved, the API reported success, and the daily rendered one blocker fewer than
// the intern had entered. The form now requires the text (and prefills it when a
// ticket is picked), so a textless blocker can only arrive from a direct API
// call; that call gets a 400 instead of a false success.
//
// Mongo, the workspace authz helper, the intern lookup, and the socket emit are
// all mocked — no DB, no network. The clock is pinned to a weekday because
// `assertEditable` reads the real one, and a daily dated on a weekend is never
// editable.

jest.mock('../models/Daily', () => ({ findById: jest.fn(), findOne: jest.fn() }));
jest.mock('../models/Ticket', () => ({ findById: jest.fn() }));
jest.mock('../models/Workspace', () => ({ findById: jest.fn() }));
jest.mock('../helpers/workspaceAuthz', () => ({ assertWorkspaceAccess: jest.fn() }));
jest.mock('../helpers/workspaceInterns', () => ({ getActiveWorkspaceInterns: jest.fn() }));
jest.mock('../socket/events', () => ({ emitDailyChanged: jest.fn() }));

const Daily = require('../models/Daily');
const Ticket = require('../models/Ticket');
const { assertWorkspaceAccess } = require('../helpers/workspaceAuthz');
const { getActiveWorkspaceInterns } = require('../helpers/workspaceInterns');
const { addEntry, updateEntry } = require('./dailyService');

const WORKSPACE = 'ws1';
const MEMBER = 'intern1';
const SCRIBE = { _id: 'mentor1', role: 'mentor' };

// A Wednesday, so the daily's own date is inside its edit window.
const TODAY = new Date('2026-08-19T09:00:00+02:00');

// Stands in for a Daily mongoose document: the fields the service reads, a
// `save()` that records what it was given, and `entries.id()` for updateEntry.
const mockDaily = (entries = []) => {
  const list = entries;
  list.id = (entryId) => list.find((entry) => entry._id === entryId) || null;
  return {
    _id: 'daily1',
    workspace: WORKSPACE,
    date: TODAY,
    entries: list,
    scribe: null,
    save: jest.fn().mockResolvedValue(undefined),
  };
};

// populateDaily() wraps Daily.findById() in .populate() — only reached on the
// paths that get as far as saving.
const populatable = (result) => ({ populate: jest.fn().mockResolvedValue(result) });

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ doNotFake: ['nextTick'] });
  jest.setSystemTime(TODAY);
  assertWorkspaceAccess.mockResolvedValue(undefined);
  getActiveWorkspaceInterns.mockResolvedValue([{ _id: MEMBER }]);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('addEntry blocker text', () => {
  it('rejects a blocker that links a ticket but carries no text, instead of dropping it', async () => {
    const daily = mockDaily();
    Daily.findById.mockResolvedValue(daily);
    Ticket.findById.mockReturnValue({
      select: () => ({ lean: () => Promise.resolve({ _id: 'ticket1', workspace: WORKSPACE }) }),
    });

    await expect(
      addEntry({
        dailyId: 'daily1',
        memberId: MEMBER,
        done: [],
        todo: [],
        blockers: [{ text: '', linkedTicket: 'ticket1' }],
        user: SCRIBE,
      })
    ).rejects.toMatchObject({
      name: 'DailyValidationError',
      statusCode: 400,
    });

    expect(daily.save).not.toHaveBeenCalled();
    expect(daily.entries).toHaveLength(0);
  });

  it('rejects whitespace-only blocker text', async () => {
    const daily = mockDaily();
    Daily.findById.mockResolvedValue(daily);

    await expect(
      addEntry({
        dailyId: 'daily1',
        memberId: MEMBER,
        done: [],
        todo: [],
        blockers: [{ text: '   ', linkedTicket: null }],
        user: SCRIBE,
      })
    ).rejects.toMatchObject({ name: 'DailyValidationError' });

    expect(daily.save).not.toHaveBeenCalled();
  });

  it('rejects the whole entry when one blocker of several has no text', async () => {
    const daily = mockDaily();
    Daily.findById.mockResolvedValue(daily);

    await expect(
      addEntry({
        dailyId: 'daily1',
        memberId: MEMBER,
        done: [],
        todo: [],
        blockers: [{ text: 'Waiting on review', linkedTicket: null }, { text: '' }],
        user: SCRIBE,
      })
    ).rejects.toMatchObject({ name: 'DailyValidationError' });

    expect(daily.save).not.toHaveBeenCalled();
  });

  it('stores a blocker that has both text and a ticket in this workspace', async () => {
    const daily = mockDaily();
    Daily.findById.mockResolvedValueOnce(daily).mockReturnValueOnce(populatable(daily));
    Ticket.findById.mockReturnValue({
      select: () => ({ lean: () => Promise.resolve({ _id: 'ticket1', workspace: WORKSPACE }) }),
    });

    await addEntry({
      dailyId: 'daily1',
      memberId: MEMBER,
      done: [],
      todo: [],
      blockers: [{ text: 'Blocked by ticket #12', linkedTicket: 'ticket1' }],
      user: SCRIBE,
    });

    expect(daily.save).toHaveBeenCalled();
    expect(daily.entries[0].blockers).toEqual([
      { text: 'Blocked by ticket #12', linkedTicket: 'ticket1' },
    ]);
  });
});

describe('updateEntry blocker text', () => {
  it('rejects a textless blocker and leaves the stored blockers untouched', async () => {
    const existing = { text: 'Waiting on design', linkedTicket: null };
    const daily = mockDaily([{ _id: 'entry1', member: MEMBER, blockers: [existing] }]);
    Daily.findById.mockResolvedValue(daily);

    await expect(
      updateEntry({
        dailyId: 'daily1',
        entryId: 'entry1',
        done: [],
        todo: [],
        blockers: [{ text: '', linkedTicket: 'ticket1' }],
        user: SCRIBE,
      })
    ).rejects.toMatchObject({ name: 'DailyValidationError' });

    expect(daily.save).not.toHaveBeenCalled();
    expect(daily.entries[0].blockers).toEqual([existing]);
  });
});
