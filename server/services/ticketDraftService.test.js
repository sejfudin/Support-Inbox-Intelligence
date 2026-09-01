// The ticket-draft service at its boundary: the reference scoping (dropped, not
// rejected), the read path re-checking stale refs, the write path skipping refs
// it already validated, and the unique-index race on a first-time upsert.
// Mongo and the sanitizer are mocked; the pure normalize/emptiness rules in
// helpers/ticketDraftRules.js run for real.

jest.mock('../models/TicketDraft', () => ({
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  deleteOne: jest.fn(),
  populate: jest.fn((doc) => Promise.resolve(doc)),
}));
jest.mock('../models/TicketStatus', () => ({ findOne: jest.fn() }));
jest.mock('../models/Category', () => ({ findOne: jest.fn() }));
jest.mock('../models/Ticket', () => ({ findOne: jest.fn() }));
jest.mock('../models/Workspace', () => ({ findById: jest.fn() }));
jest.mock('../helpers/htmlSanitize', () => ({ sanitizeDescriptionHtml: jest.fn((v) => v ?? '') }));

const TicketDraft = require('../models/TicketDraft');
const TicketStatus = require('../models/TicketStatus');
const Category = require('../models/Category');
const Ticket = require('../models/Ticket');
const Workspace = require('../models/Workspace');
const { getDraft, saveDraft } = require('./ticketDraftService');

const USER = '5f000000000000000000a001';
const WS = '5f000000000000000000b001';
const STATUS_A = '5f000000000000000000c001';
const STATUS_B = '5f000000000000000000c002';
const CATEGORY = '5f000000000000000000d001';

// A query stub: `.select()` chains, `.lean()` and `.populate()` settle it.
const q = (value) => {
  const query = {};
  query.select = () => query;
  query.lean = () => Promise.resolve(value);
  query.populate = () => Promise.resolve(value);
  return query;
};

const storedDraft = (over = {}) => ({
  user: USER,
  workspace: WS,
  subject: 'Half a sentence',
  description: '<p>body</p>',
  status: STATUS_A,
  priority: 'high',
  storyPoints: 3,
  assignedTo: [],
  dueDate: '',
  category: null,
  blockedBy: { ticket: null, note: '' },
  ...over,
});

const input = (over = {}) => ({
  subject: 'Half a sentence',
  description: '<p>body</p>',
  status: STATUS_A,
  priority: 'high',
  storyPoints: 3,
  assignedTo: [],
  dueDate: '',
  category: null,
  blockedBy: { ticket: null, note: '' },
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  TicketDraft.deleteOne.mockResolvedValue({ deletedCount: 1 });
  TicketDraft.findOneAndUpdate.mockReturnValue(q({ toObject: () => storedDraft() }));
});

describe('getDraft', () => {
  it('returns null when nothing is stored', async () => {
    TicketDraft.findOne.mockReturnValue(q(null));
    await expect(getDraft({ userId: USER, workspaceId: WS })).resolves.toBeNull();
  });

  it('drops a status that has been deleted since the draft was saved', async () => {
    TicketDraft.findOne.mockReturnValue(q(storedDraft({ status: STATUS_A })));
    TicketStatus.findOne.mockReturnValue(q(null)); // status no longer exists
    Category.findOne.mockReturnValue(q(null));
    Ticket.findOne.mockReturnValue(q(null));

    const draft = await getDraft({ userId: USER, workspaceId: WS });

    expect(TicketStatus.findOne).toHaveBeenCalledWith({ _id: STATUS_A, workspace: WS });
    expect(draft.status).toBeNull();
  });

  it('keeps a status and category that still belong to the workspace', async () => {
    TicketDraft.findOne.mockReturnValue(q(storedDraft({ status: STATUS_A, category: CATEGORY })));
    TicketStatus.findOne.mockReturnValue(q({ _id: STATUS_A }));
    Category.findOne.mockReturnValue(q({ _id: CATEGORY }));
    Ticket.findOne.mockReturnValue(q(null));

    const draft = await getDraft({ userId: USER, workspaceId: WS });

    expect(draft.status).toBe(STATUS_A);
    expect(draft.category).toBe(CATEGORY);
  });
});

describe('saveDraft', () => {
  it('deletes the row when the form has been emptied out', async () => {
    const result = await saveDraft({
      userId: USER,
      workspaceId: WS,
      input: input({ subject: '', description: '<p></p>', storyPoints: null }),
    });

    expect(result).toBeNull();
    expect(TicketDraft.deleteOne).toHaveBeenCalledWith({ user: USER, workspace: WS });
    expect(TicketDraft.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('does not re-validate a status that is unchanged from the stored draft', async () => {
    TicketDraft.findOne.mockReturnValue(q(storedDraft({ status: STATUS_A })));

    await saveDraft({ userId: USER, workspaceId: WS, input: input({ status: STATUS_A }) });

    expect(TicketStatus.findOne).not.toHaveBeenCalled();
    const [, update] = TicketDraft.findOneAndUpdate.mock.calls[0];
    expect(String(update.$set.status)).toBe(STATUS_A);
  });

  it('re-validates a status that changed, and drops it when it does not belong', async () => {
    TicketDraft.findOne.mockReturnValue(q(storedDraft({ status: STATUS_A })));
    TicketStatus.findOne.mockReturnValue(q(null)); // STATUS_B is not in this workspace

    await saveDraft({ userId: USER, workspaceId: WS, input: input({ status: STATUS_B }) });

    expect(TicketStatus.findOne).toHaveBeenCalledWith({ _id: STATUS_B, workspace: WS });
    const [, update] = TicketDraft.findOneAndUpdate.mock.calls[0];
    expect(update.$set.status).toBeNull();
  });

  it('retries once without upsert when a concurrent first save hits the unique index', async () => {
    TicketDraft.findOne.mockReturnValue(q(null)); // no previous draft
    TicketStatus.findOne.mockReturnValue(q({ _id: STATUS_A }));
    const dupKey = Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
    TicketDraft.findOneAndUpdate
      .mockReturnValueOnce({ populate: () => Promise.reject(dupKey) })
      .mockReturnValueOnce(q({ toObject: () => storedDraft() }));

    const result = await saveDraft({ userId: USER, workspaceId: WS, input: input() });

    expect(TicketDraft.findOneAndUpdate).toHaveBeenCalledTimes(2);
    expect(TicketDraft.findOneAndUpdate.mock.calls[1][2]).toEqual({ new: true });
    expect(result).toMatchObject({ subject: 'Half a sentence' });
  });

  it('rethrows a write error that is not a duplicate key', async () => {
    TicketDraft.findOne.mockReturnValue(q(null));
    TicketStatus.findOne.mockReturnValue(q({ _id: STATUS_A }));
    TicketDraft.findOneAndUpdate.mockReturnValueOnce({
      populate: () => Promise.reject(new Error('connection reset')),
    });

    await expect(saveDraft({ userId: USER, workspaceId: WS, input: input() })).rejects.toThrow(
      'connection reset'
    );
    expect(TicketDraft.findOneAndUpdate).toHaveBeenCalledTimes(1);
  });
});
