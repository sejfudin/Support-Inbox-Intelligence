// Sprint membership at the service boundary. Three rules decide what adding a
// ticket to a sprint actually does, and none of them is enforced by the schema:
//
// - Adding a backlog ticket promotes it into the workspace's default main
//   status in the SAME update, so it lands in a column of the sprint board
//   instead of in none (ADR 0009).
// - Removing is deliberately NOT the inverse. It clears the sprint and leaves
//   the status alone — nothing ever sends a ticket back to the backlog.
// - A ticket with no story points cannot join a sprint, because progress is
//   measured in points and an unestimated ticket would be worth zero forever
//   (ADR 0011). Enforced here, not only in the planning modal.
//
// Mongo, the sibling services and the socket emit are all mocked — no database,
// no network. The assertions read the `$set` the service hands to Mongo, which
// is where "promotes it in the same operation" is either true or not.

jest.mock('../models/Ticket', () => ({
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  find: jest.fn(),
  countDocuments: jest.fn(),
  aggregate: jest.fn(),
}));
jest.mock('../models/Sprint', () => ({ findOne: jest.fn(), findById: jest.fn() }));
jest.mock('../models/Comment', () => ({ aggregate: jest.fn() }));
jest.mock('../models/Category', () => ({ findById: jest.fn(), findOne: jest.fn() }));
jest.mock('../models/Workspace', () => ({ findById: jest.fn() }));
jest.mock('../models/InternProfile', () => ({ find: jest.fn(), findOne: jest.fn() }));
jest.mock('../models/User', () => ({ find: jest.fn(), findById: jest.fn() }));
jest.mock('./notificationService', () => ({
  notifyTicketAssigned: jest.fn(),
  notifyTicketReviewRequested: jest.fn(),
  notifyTicketReviewCompleted: jest.fn(),
}));
jest.mock('./historyService', () => ({ logEvent: jest.fn() }));
jest.mock('./statusService', () => ({
  resolveStatusForWorkspace: jest.fn(),
  getStatusDocFromTicketRef: jest.fn(),
  resolveDefaultStatus: jest.fn(),
  applyStatusLifecycleUpdate: jest.fn(),
  statusIdsMatch: jest.fn(),
  getBacklogStatusIds: jest.fn(),
  getStatusIdForSlug: jest.fn(),
  slugifyLabel: jest.fn((value) => value),
}));
// Not isolation: requiring the real sanitizer pulls in `sanitize-html`, which
// ships ESM that Jest will not parse. Nothing here sends a description.
jest.mock('../helpers/htmlSanitize', () => ({
  sanitizeDescriptionHtml: jest.fn((value) => value),
}));
jest.mock('../socket/events', () => ({
  emitTicketEvent: jest.fn(),
  toSocketId: jest.fn((value) => (value ? String(value) : null)),
}));

const Ticket = require('../models/Ticket');
const Sprint = require('../models/Sprint');
const statusService = require('./statusService');
const {
  updateTicket,
  setSprintMembership,
  bulkUpdateTicketStatus,
  bulkArchiveTickets,
  MAX_BULK_TICKETS,
} = require('./ticketService');
const { SPRINT_ESTIMATE_REQUIRED } = require('../helpers/sprintRules');

const WORKSPACE = '507f1f77bcf86cd799439011';
const TICKET_ID = '507f1f77bcf86cd799439012';
const OTHER_TICKET_ID = '507f1f77bcf86cd799439013';
const SPRINT_ID = '507f1f77bcf86cd799439014';
const ACTOR = '507f1f77bcf86cd799439015';
const BACKLOG_STATUS_ID = '507f1f77bcf86cd799439016';
const MAIN_STATUS_ID = '507f1f77bcf86cd799439017';
const IN_PROGRESS_STATUS_ID = '507f1f77bcf86cd799439018';

const backlogStatus = {
  _id: BACKLOG_STATUS_ID,
  slug: 'backlog',
  label: 'Backlog',
  isBacklog: true,
  isDone: false,
  tracksTime: false,
};
const mainStatus = {
  _id: MAIN_STATUS_ID,
  slug: 'to-do',
  label: 'To do',
  isBacklog: false,
  isDone: false,
  tracksTime: false,
};
const inProgressStatus = {
  _id: IN_PROGRESS_STATUS_ID,
  slug: 'in-progress',
  label: 'In progress',
  isBacklog: false,
  isDone: false,
  tracksTime: true,
};

// Stands in for the ticket document `updateTicket` reads before it writes: the
// fields the service consults, and none of the model's validation.
const mockTicket = (overrides = {}) => ({
  _id: TICKET_ID,
  workspace: WORKSPACE,
  status: BACKLOG_STATUS_ID,
  storyPoints: 3,
  sprint: null,
  assignedTo: [],
  blockedBy: { ticket: null, note: '' },
  reviewRequest: null,
  ...overrides,
});

// `findByIdAndUpdate(...).populate().populate()...` — the chain the service
// calls, thenable so `await` resolves it whichever link it stops on.
const populatable = (result) => {
  const chain = {
    populate: jest.fn(() => chain),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return chain;
};

// The `$set` the service handed to Mongo — the subject of every assertion here.
const writtenUpdate = () => Ticket.findByIdAndUpdate.mock.calls[0][1].$set;

const statusById = {
  [BACKLOG_STATUS_ID]: backlogStatus,
  [MAIN_STATUS_ID]: mainStatus,
  [IN_PROGRESS_STATUS_ID]: inProgressStatus,
};

beforeEach(() => {
  jest.clearAllMocks();

  Sprint.findById.mockReturnValue({
    select: () => ({ lean: () => Promise.resolve({ name: 'Sprint 14' }) }),
  });
  Sprint.findOne.mockReturnValue({
    select: () => ({ lean: () => Promise.resolve({ _id: SPRINT_ID, name: 'Sprint 14' }) }),
  });
  statusService.getStatusDocFromTicketRef.mockImplementation(
    async (ref) => statusById[ref] || null
  );
  statusService.resolveStatusForWorkspace.mockImplementation(async (_ws, ref) => statusById[ref]);
  statusService.resolveDefaultStatus.mockResolvedValue(mainStatus);
  statusService.statusIdsMatch.mockImplementation((a, b) => String(a) === String(b));
  Ticket.findByIdAndUpdate.mockImplementation((_id, update) =>
    populatable({ _id: TICKET_ID, workspace: WORKSPACE, ...update.$set })
  );
});

describe('adding a ticket to a sprint', () => {
  it('promotes a backlog ticket into the default main status in the same update', async () => {
    Ticket.findById.mockResolvedValue(mockTicket());

    await updateTicket(TICKET_ID, { sprint: SPRINT_ID }, ACTOR);

    expect(writtenUpdate()).toMatchObject({ sprint: SPRINT_ID, status: MAIN_STATUS_ID });
    expect(Ticket.findByIdAndUpdate).toHaveBeenCalledTimes(1);
  });

  it('promotes even when the same request names a status, so the state ADR 0009 forbids is unreachable', async () => {
    Ticket.findById.mockResolvedValue(mockTicket());

    await updateTicket(TICKET_ID, { sprint: SPRINT_ID, status: BACKLOG_STATUS_ID }, ACTOR);

    expect(writtenUpdate()).toMatchObject({ sprint: SPRINT_ID, status: MAIN_STATUS_ID });
  });

  it('leaves the status alone when the ticket has already left the backlog', async () => {
    Ticket.findById.mockResolvedValue(mockTicket({ status: IN_PROGRESS_STATUS_ID }));

    await updateTicket(TICKET_ID, { sprint: SPRINT_ID }, ACTOR);

    expect(writtenUpdate()).toMatchObject({ sprint: SPRINT_ID });
    expect(writtenUpdate()).not.toHaveProperty('status');
    expect(statusService.resolveDefaultStatus).not.toHaveBeenCalled();
  });

  it('refuses an unestimated ticket rather than letting it into the sprint', async () => {
    Ticket.findById.mockResolvedValue(mockTicket({ storyPoints: null }));

    await expect(updateTicket(TICKET_ID, { sprint: SPRINT_ID }, ACTOR)).rejects.toMatchObject({
      statusCode: 400,
      message: SPRINT_ESTIMATE_REQUIRED,
    });
    expect(Ticket.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('accepts an estimate supplied in the same request as the sprint', async () => {
    Ticket.findById.mockResolvedValue(mockTicket({ storyPoints: null }));

    await updateTicket(TICKET_ID, { sprint: SPRINT_ID, storyPoints: 2 }, ACTOR);

    expect(writtenUpdate()).toMatchObject({ sprint: SPRINT_ID, storyPoints: 2 });
  });

  it('refuses a sprint from another workspace', async () => {
    Ticket.findById.mockResolvedValue(mockTicket());
    Sprint.findById.mockReturnValue({
      select: () => ({ lean: () => Promise.resolve({ name: 'Sprint 14' }) }),
    });
    Sprint.findOne.mockReturnValue({ select: () => ({ lean: () => Promise.resolve(null) }) });

    await expect(updateTicket(TICKET_ID, { sprint: SPRINT_ID }, ACTOR)).rejects.toThrow(
      'Sprint is not valid for this workspace'
    );
    expect(Ticket.findByIdAndUpdate).not.toHaveBeenCalled();
  });
});

describe('removing a ticket from a sprint', () => {
  it('clears the sprint and does not move the ticket back to the backlog', async () => {
    Ticket.findById.mockResolvedValue(
      mockTicket({ status: IN_PROGRESS_STATUS_ID, sprint: SPRINT_ID })
    );

    await updateTicket(TICKET_ID, { sprint: null }, ACTOR);

    expect(writtenUpdate()).toMatchObject({ sprint: null });
    expect(writtenUpdate()).not.toHaveProperty('status');
  });

  it('is a no-op write for a ticket that was in no sprint', async () => {
    Ticket.findById.mockResolvedValue(mockTicket({ status: IN_PROGRESS_STATUS_ID }));

    await updateTicket(TICKET_ID, { sprint: null }, ACTOR);

    expect(writtenUpdate()).not.toHaveProperty('sprint');
  });
});

describe('setSprintMembership', () => {
  const lean = (value) => ({ select: () => ({ lean: () => Promise.resolve(value) }) });

  it('puts every ticket in the batch through the same update path', async () => {
    Ticket.find.mockReturnValue(
      lean([
        { _id: TICKET_ID, storyPoints: 3, sprint: null },
        { _id: OTHER_TICKET_ID, storyPoints: 1, sprint: null },
      ])
    );
    Ticket.findById.mockResolvedValue(mockTicket());

    const result = await setSprintMembership({
      ticketIds: [TICKET_ID, OTHER_TICKET_ID],
      sprintId: SPRINT_ID,
      workspaceId: WORKSPACE,
      actorUserId: ACTOR,
    });

    expect(result).toHaveLength(2);
    expect(Ticket.findByIdAndUpdate).toHaveBeenCalledTimes(2);
  });

  it('writes nothing at all when one ticket in the batch has no estimate', async () => {
    Ticket.find.mockReturnValue(
      lean([
        { _id: TICKET_ID, storyPoints: 3, sprint: null },
        { _id: OTHER_TICKET_ID, storyPoints: null, sprint: null },
      ])
    );

    await expect(
      setSprintMembership({
        ticketIds: [TICKET_ID, OTHER_TICKET_ID],
        sprintId: SPRINT_ID,
        workspaceId: WORKSPACE,
        actorUserId: ACTOR,
      })
    ).rejects.toMatchObject({ message: SPRINT_ESTIMATE_REQUIRED });
    expect(Ticket.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('refuses a batch naming a ticket from another workspace', async () => {
    Ticket.find.mockReturnValue(lean([{ _id: TICKET_ID, storyPoints: 3, sprint: null }]));

    await expect(
      setSprintMembership({
        ticketIds: [TICKET_ID, OTHER_TICKET_ID],
        sprintId: SPRINT_ID,
        workspaceId: WORKSPACE,
        actorUserId: ACTOR,
      })
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(Ticket.findByIdAndUpdate).not.toHaveBeenCalled();
  });
});

// A board column's selection moved or archived in one request. What matters here
// is that the batch reuses the single-ticket paths (so history, sockets and the
// status rules cannot drift), that it writes nothing when any id is not a ticket
// of this workspace, and that it skips the tickets the operation is a no-op for.
describe('bulk column actions', () => {
  const lean = (value) => ({ select: () => ({ lean: () => Promise.resolve(value) }) });

  beforeEach(() => {
    Ticket.findById.mockResolvedValue(mockTicket({ status: MAIN_STATUS_ID }));
  });

  it('moves every selected ticket through the same update path', async () => {
    Ticket.find.mockReturnValue(
      lean([
        { _id: TICKET_ID, status: MAIN_STATUS_ID, isArchived: false },
        { _id: OTHER_TICKET_ID, status: MAIN_STATUS_ID, isArchived: false },
      ])
    );

    const result = await bulkUpdateTicketStatus({
      ticketIds: [TICKET_ID, OTHER_TICKET_ID],
      statusId: IN_PROGRESS_STATUS_ID,
      workspaceId: WORKSPACE,
      actorUserId: ACTOR,
    });

    expect(result).toHaveLength(2);
    expect(Ticket.findByIdAndUpdate).toHaveBeenCalledTimes(2);
    expect(writtenUpdate()).toMatchObject({ status: IN_PROGRESS_STATUS_ID });
  });

  it('skips the tickets already sitting in the destination status', async () => {
    Ticket.find.mockReturnValue(
      lean([
        { _id: TICKET_ID, status: IN_PROGRESS_STATUS_ID, isArchived: false },
        { _id: OTHER_TICKET_ID, status: MAIN_STATUS_ID, isArchived: false },
      ])
    );

    await bulkUpdateTicketStatus({
      ticketIds: [TICKET_ID, OTHER_TICKET_ID],
      statusId: IN_PROGRESS_STATUS_ID,
      workspaceId: WORKSPACE,
      actorUserId: ACTOR,
    });

    expect(Ticket.findByIdAndUpdate).toHaveBeenCalledTimes(1);
  });

  it('writes nothing when one id is not a ticket of this workspace', async () => {
    Ticket.find.mockReturnValue(lean([{ _id: TICKET_ID, status: MAIN_STATUS_ID }]));

    await expect(
      bulkUpdateTicketStatus({
        ticketIds: [TICKET_ID, OTHER_TICKET_ID],
        statusId: IN_PROGRESS_STATUS_ID,
        workspaceId: WORKSPACE,
        actorUserId: ACTOR,
      })
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(Ticket.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('refuses the backlog as a bulk destination, as a single move does', async () => {
    Ticket.find.mockReturnValue(lean([{ _id: TICKET_ID, status: MAIN_STATUS_ID }]));

    await expect(
      bulkUpdateTicketStatus({
        ticketIds: [TICKET_ID],
        statusId: BACKLOG_STATUS_ID,
        workspaceId: WORKSPACE,
        actorUserId: ACTOR,
      })
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(Ticket.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('refuses a selection larger than the batch cap before reading anything', async () => {
    const ids = Array.from({ length: MAX_BULK_TICKETS + 1 }, (_, index) =>
      String(index).padStart(24, '0')
    );

    await expect(
      bulkArchiveTickets({ ticketIds: ids, workspaceId: WORKSPACE, actorUserId: ACTOR })
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(Ticket.find).not.toHaveBeenCalled();
  });

  it('archives only the tickets that are not archived yet', async () => {
    Ticket.find.mockReturnValue(
      lean([
        { _id: TICKET_ID, status: MAIN_STATUS_ID, isArchived: false },
        { _id: OTHER_TICKET_ID, status: MAIN_STATUS_ID, isArchived: true },
      ])
    );
    Ticket.findById.mockReturnValue({
      select: () => Promise.resolve({ reviewRequest: null }),
    });

    const result = await bulkArchiveTickets({
      ticketIds: [TICKET_ID, OTHER_TICKET_ID],
      workspaceId: WORKSPACE,
      actorUserId: ACTOR,
    });

    expect(result).toHaveLength(1);
    expect(writtenUpdate()).toMatchObject({ isArchived: true });
  });
});
