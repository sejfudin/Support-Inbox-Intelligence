// Wiring-level cover for the sprint recap service. The number-shaping lives in
// helpers/sprintSummaryData.test.js and helpers/sprintRules.test.js; what this
// checks is the generate path's control flow: no Groq call when nothing is done,
// the empty recap is still persisted (not 502'd on every tab open), the upsert
// is workspace-scoped, and a first-generate race on the unique index resolves to
// the winner's document instead of a 500.

jest.mock('../models/Ticket', () => ({ find: jest.fn() }));
jest.mock('../models/TicketStatus', () => ({ find: jest.fn() }));
jest.mock('../models/Workspace', () => ({ findById: jest.fn() }));
jest.mock('../models/SprintAISummary', () => ({ findOne: jest.fn(), findOneAndUpdate: jest.fn() }));
jest.mock('./groqAiClient', () => ({
  requestGroqOutputText: jest.fn(),
  extractJsonObject: jest.requireActual('./groqAiClient').extractJsonObject,
  createAiServiceError: jest.requireActual('./groqAiClient').createAiServiceError,
}));
jest.mock('./sprintService', () => ({ assertSprintInWorkspace: jest.fn() }));

const Ticket = require('../models/Ticket');
const TicketStatus = require('../models/TicketStatus');
const Workspace = require('../models/Workspace');
const SprintAISummary = require('../models/SprintAISummary');
const { requestGroqOutputText } = require('./groqAiClient');
const sprintService = require('./sprintService');
const { getSprintSummary, generateSprintSummary } = require('./sprintSummaryService');

const WORKSPACE_ID = 'ws1';
const SPRINT = {
  _id: 's1',
  name: 'Sprint 9',
  goal: '',
  start: new Date('2026-08-03T00:00:00.000Z'),
  end: new Date('2026-08-14T00:00:00.000Z'),
};
const TODAY = new Date('2026-08-20T00:00:00.000Z');

const STATUSES = [
  { _id: 'backlog', slug: 'backlog', isBacklog: true, sortOrder: 0 },
  { _id: 'todo', slug: 'to do', sortOrder: 1 },
  { _id: 'doing', slug: 'in progress', sortOrder: 2 },
  { _id: 'done', slug: 'done', isDone: true, sortOrder: 3 },
];

const MEMBERS = [
  { status: 'active', user: { _id: 'u1', fullname: 'Ann Dev' } },
  { status: 'active', user: { _id: 'u2', fullname: 'Bo Coder' } },
];

const ticket = (over = {}) => ({
  subject: 'A ticket',
  description: '<p>body</p>',
  taskNumber: 1,
  status: 'todo',
  storyPoints: 2,
  assignedTo: ['u1'],
  isArchived: false,
  ...over,
});

// A mongoose query stub: every refinement returns itself, `.lean()` settles it.
const query = (value, { reject = false } = {}) => {
  const q = {};
  q.sort = () => q;
  q.select = () => q;
  q.populate = () => q;
  q.lean = () => (reject ? Promise.reject(value) : Promise.resolve(value));
  return q;
};

const primeContext = (tickets) => {
  TicketStatus.find.mockReturnValue(query(STATUSES));
  Ticket.find.mockReturnValue(query(tickets));
  Workspace.findById.mockReturnValue(query({ members: MEMBERS }));
};

beforeEach(() => {
  jest.clearAllMocks();
  sprintService.assertSprintInWorkspace.mockResolvedValue(SPRINT);
});

describe('generateSprintSummary', () => {
  it('persists an empty recap without a Groq call when nothing is in the done bucket', async () => {
    primeContext([
      ticket({ taskNumber: 1, status: 'todo' }),
      ticket({ taskNumber: 2, status: 'doing' }),
    ]);
    SprintAISummary.findOneAndUpdate.mockReturnValue(
      query({ team: { themes: [] }, perUser: [], sourceHash: 'h', generatedAt: TODAY })
    );

    const res = await generateSprintSummary({
      sprintId: 's1',
      workspaceId: WORKSPACE_ID,
      requesterId: 'u1',
      today: TODAY,
    });

    expect(requestGroqOutputText).not.toHaveBeenCalled();
    expect(SprintAISummary.findOneAndUpdate).toHaveBeenCalledTimes(1);
    const [filter, update] = SprintAISummary.findOneAndUpdate.mock.calls[0];
    expect(filter).toEqual({ sprint: 's1', workspace: WORKSPACE_ID });
    expect(update.team).toEqual({ themes: [] });
    expect(update.perUser).toEqual([]);
    expect(res.hasSummary).toBe(true);
    expect(res.team.themes).toEqual([]);
  });

  it('calls Groq and stores the parsed themes when there is done work', async () => {
    primeContext([
      ticket({ taskNumber: 1, status: 'done', assignedTo: ['u1'], storyPoints: 3 }),
      ticket({ taskNumber: 2, status: 'todo', assignedTo: ['u2'] }),
    ]);
    requestGroqOutputText.mockResolvedValue(
      JSON.stringify({
        team: { themes: ['Settings Cleanup - removed dead options'] },
        perUser: [{ userId: 'u1', themes: ['Settings Cleanup - removed dead options'] }],
      })
    );
    SprintAISummary.findOneAndUpdate.mockImplementation((filter, update) =>
      query({ ...update, generatedAt: TODAY, perUser: update.perUser })
    );

    const res = await generateSprintSummary({
      sprintId: 's1',
      workspaceId: WORKSPACE_ID,
      requesterId: 'u1',
      today: TODAY,
    });

    expect(requestGroqOutputText).toHaveBeenCalledTimes(1);
    expect(res.team.themes).toEqual(['Settings Cleanup - removed dead options']);
    expect(SprintAISummary.findOneAndUpdate.mock.calls[0][0]).toEqual({
      sprint: 's1',
      workspace: WORKSPACE_ID,
    });
  });

  it('still 502s when the model returns nothing for a sprint that DID finish work', async () => {
    primeContext([ticket({ taskNumber: 1, status: 'done' })]);
    requestGroqOutputText.mockResolvedValue(JSON.stringify({ team: { themes: [] }, perUser: [] }));

    await expect(
      generateSprintSummary({
        sprintId: 's1',
        workspaceId: WORKSPACE_ID,
        requesterId: 'u1',
        today: TODAY,
      })
    ).rejects.toMatchObject({ statusCode: 502 });
    expect(SprintAISummary.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('returns the winning document when a concurrent first generate hits the unique index', async () => {
    primeContext([ticket({ taskNumber: 1, status: 'done' })]);
    requestGroqOutputText.mockResolvedValue(
      JSON.stringify({ team: { themes: ['Mine - lost the race'] }, perUser: [] })
    );
    const dupKey = Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
    SprintAISummary.findOneAndUpdate.mockReturnValue(query(dupKey, { reject: true }));
    SprintAISummary.findOne.mockReturnValue(
      query({ team: { themes: ['Theirs - won the race'] }, perUser: [], generatedAt: TODAY })
    );

    const res = await generateSprintSummary({
      sprintId: 's1',
      workspaceId: WORKSPACE_ID,
      requesterId: 'u1',
      today: TODAY,
    });

    expect(res.team.themes).toEqual(['Theirs - won the race']);
    expect(SprintAISummary.findOne).toHaveBeenCalledWith({ sprint: 's1', workspace: WORKSPACE_ID });
  });

  it('rethrows a non-duplicate write error untouched', async () => {
    primeContext([ticket({ taskNumber: 1, status: 'done' })]);
    requestGroqOutputText.mockResolvedValue(
      JSON.stringify({ team: { themes: ['X - y'] }, perUser: [] })
    );
    SprintAISummary.findOneAndUpdate.mockReturnValue(
      query(new Error('connection reset'), { reject: true })
    );

    await expect(
      generateSprintSummary({
        sprintId: 's1',
        workspaceId: WORKSPACE_ID,
        requesterId: 'u1',
        today: TODAY,
      })
    ).rejects.toThrow('connection reset');
    expect(SprintAISummary.findOne).not.toHaveBeenCalled();
  });

  it('422s a sprint with no tickets at all', async () => {
    primeContext([]);

    await expect(
      generateSprintSummary({
        sprintId: 's1',
        workspaceId: WORKSPACE_ID,
        requesterId: 'u1',
        today: TODAY,
      })
    ).rejects.toMatchObject({ statusCode: 422 });
  });
});

describe('getSprintSummary', () => {
  it('reads the recap with a workspace-scoped filter and reports hasSummary:false when none exists', async () => {
    primeContext([ticket({ taskNumber: 1, status: 'done' })]);
    SprintAISummary.findOne.mockReturnValue(query(null));

    const res = await getSprintSummary({ sprintId: 's1', workspaceId: WORKSPACE_ID, today: TODAY });

    expect(SprintAISummary.findOne).toHaveBeenCalledWith({ sprint: 's1', workspace: WORKSPACE_ID });
    expect(res.hasSummary).toBe(false);
    expect(res.team.themes).toEqual([]);
    expect(res.team.tickets.done).toBe(1);
  });
});
