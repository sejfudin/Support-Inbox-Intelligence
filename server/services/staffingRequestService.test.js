// Wiring-level cover for the close / reopen / put-forward paths. Who may do
// what is decided by helpers/staffingRequestRules.js and tested there; what
// this checks is what the service does around those decisions — which field the
// supplied note lands in per reason (they are not interchangeable), that the
// close markers are written and cleared, that putting interns forward creates
// recommendations tagged to the request with the position forced, and that a
// "not you" refusal comes back as 403 while an illegal move comes back as 400.
// Mongo is mocked.

jest.mock('../models/StaffingRequest', () => ({ findById: jest.fn() }));
jest.mock('../models/Recommendation', () => ({ find: jest.fn() }));
jest.mock('../models/Project', () => ({ findById: jest.fn() }));
jest.mock('../models/Position', () => ({ findById: jest.fn() }));
jest.mock('../models/Technology', () => ({ find: jest.fn() }));
jest.mock('../models/InternProfile', () => ({ find: jest.fn() }));
// Not just isolation: requiring the real recommendationService pulls in
// Supabase config, which throws without env.
jest.mock('./recommendationService', () => ({
  createRecommendationsForStaffingRequest: jest.fn().mockResolvedValue([]),
}));
jest.mock('./historyService', () => ({ logStaffingRequestEvent: jest.fn().mockResolvedValue() }));
jest.mock('../socket/events', () => ({ emitStaffingNewsChanged: jest.fn() }));

const StaffingRequest = require('../models/StaffingRequest');
const Recommendation = require('../models/Recommendation');
const InternProfile = require('../models/InternProfile');
const { createRecommendationsForStaffingRequest } = require('./recommendationService');
const { logStaffingRequestEvent } = require('./historyService');
const { ROLES } = require('../constants/roles');
const {
  closeStaffingRequest,
  reopenStaffingRequest,
  putInternsForward,
} = require('./staffingRequestService');

const REQUEST_ID = '507f1f77bcf86cd799439011';
const AUTHOR_ID = '507f1f77bcf86cd799439012';
const ADMIN_ID = '507f1f77bcf86cd799439013';
const PROJECT_ID = '507f1f77bcf86cd799439015';
const POSITION_ID = '507f1f77bcf86cd799439016';
const PROFILE_ID = '507f1f77bcf86cd799439017';
const OTHER_PROFILE_ID = '507f1f77bcf86cd799439018';
const TECHNOLOGY_ID = '507f1f77bcf86cd799439019';

const author = { _id: AUTHOR_ID, role: ROLES.LEADERSHIP };
const admin = { _id: ADMIN_ID, role: ROLES.ADMIN };
const otherLeader = { _id: '507f1f77bcf86cd799439014', role: ROLES.LEADERSHIP };

// A stand-in for the Mongoose document: real enough for the service (save,
// populate, toObject, assignable fields), with none of the model's validation —
// that the model accepts what we write here is the model's own contract.
const mockRequest = (overrides = {}) => {
  const doc = {
    _id: REQUEST_ID,
    project: PROJECT_ID,
    author: AUTHOR_ID,
    status: 'open',
    reason: undefined,
    note: '',
    closeNote: '',
    requestedPositions: [{ position: POSITION_ID, count: 2, technologies: [TECHNOLOGY_ID] }],
    save: jest.fn().mockResolvedValue(undefined),
    populate: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  doc.toObject = () => ({ ...doc });
  return doc;
};

const arrange = (doc) => {
  StaffingRequest.findById.mockResolvedValue(doc);
  Recommendation.find.mockReturnValue({
    select: () => ({
      lean: async () => [],
      populate: () => ({ populate: () => ({ lean: async () => [] }) }),
    }),
  });
  return doc;
};

const expectHttpError = async (promise, statusCode) => {
  await expect(promise).rejects.toMatchObject({ statusCode });
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('putInternsForward', () => {
  // Two Recommendation.find shapes run through this path: the already-put-
  // forward lookup (select().lean()) and the tagged-recommendation reload
  // behind the response (select().populate().populate().lean()). `arrange`
  // already answers both with an empty list.
  const arrangeCandidates = (profiles) => {
    InternProfile.find.mockReturnValue({
      select: () => ({ lean: async () => profiles }),
    });
  };

  it('creates recommendations tagged to the request, with the position forced', async () => {
    const doc = arrange(mockRequest());
    arrangeCandidates([
      { _id: PROFILE_ID, status: 'ready' },
      { _id: OTHER_PROFILE_ID, status: 'ready' },
    ]);

    await putInternsForward(admin, REQUEST_ID, POSITION_ID, {
      internProfileIds: [PROFILE_ID, OTHER_PROFILE_ID],
    });

    expect(createRecommendationsForStaffingRequest).toHaveBeenCalledWith(admin, {
      internProfileIds: [PROFILE_ID, OTHER_PROFILE_ID],
      positionId: POSITION_ID,
      projectId: doc.project,
      staffingRequestId: REQUEST_ID,
      technologyIds: [TECHNOLOGY_ID],
    });
  });

  it('appends a history event so the other side is badged', async () => {
    arrange(mockRequest());
    arrangeCandidates([{ _id: PROFILE_ID, status: 'ready' }]);

    await putInternsForward(admin, REQUEST_ID, POSITION_ID, { internProfileIds: [PROFILE_ID] });

    expect(logStaffingRequestEvent).toHaveBeenCalledWith(
      expect.objectContaining({ statusKey: 'staffing:put_forward', userId: ADMIN_ID })
    );
  });

  // Over-supply is expected, not blocked — interviews fail.
  it('allows more interns than the requested count', async () => {
    arrange(mockRequest({ requestedPositions: [{ position: POSITION_ID, count: 1 }] }));
    arrangeCandidates([
      { _id: PROFILE_ID, status: 'ready' },
      { _id: OTHER_PROFILE_ID, status: 'ready' },
    ]);

    await putInternsForward(admin, REQUEST_ID, POSITION_ID, {
      internProfileIds: [PROFILE_ID, OTHER_PROFILE_ID],
    });

    expect(createRecommendationsForStaffingRequest).toHaveBeenCalled();
  });

  it('refuses a non-admin with a 403', async () => {
    arrange(mockRequest());
    await expectHttpError(
      putInternsForward(author, REQUEST_ID, POSITION_ID, { internProfileIds: [PROFILE_ID] }),
      403
    );
    expect(createRecommendationsForStaffingRequest).not.toHaveBeenCalled();
  });

  it('refuses a request whose draft project is unresolved', async () => {
    arrange(mockRequest({ project: null, draftProject: { name: 'Kestrel' } }));
    await expectHttpError(
      putInternsForward(admin, REQUEST_ID, POSITION_ID, { internProfileIds: [PROFILE_ID] }),
      400
    );
  });

  it('refuses a closed request', async () => {
    arrange(mockRequest({ status: 'closed', reason: 'cancelled' }));
    await expectHttpError(
      putInternsForward(admin, REQUEST_ID, POSITION_ID, { internProfileIds: [PROFILE_ID] }),
      400
    );
  });

  // The position is not a free choice in this flow: it must be one this
  // request actually asked for.
  it('refuses a position that is not on the request', async () => {
    arrange(mockRequest());
    await expectHttpError(
      putInternsForward(admin, REQUEST_ID, OTHER_PROFILE_ID, { internProfileIds: [PROFILE_ID] }),
      400
    );
  });

  it('refuses an empty pick', async () => {
    arrange(mockRequest());
    await expectHttpError(putInternsForward(admin, REQUEST_ID, POSITION_ID, {}), 400);
  });

  // The picker rules hold server-side, not only in the UI.
  it('refuses an intern who has left the programme', async () => {
    arrange(mockRequest());
    arrangeCandidates([{ _id: PROFILE_ID, status: 'discontinued' }]);

    await expectHttpError(
      putInternsForward(admin, REQUEST_ID, POSITION_ID, { internProfileIds: [PROFILE_ID] }),
      400
    );
    expect(createRecommendationsForStaffingRequest).not.toHaveBeenCalled();
  });

  // Only LIVE tags exclude. Someone whose process here fell through is a
  // legitimate pick again — `Recommendation.find` is called with a status
  // filter, so a resolved tag never reaches the picker rules at all.
  it('looks only at still-live tags when refusing a duplicate', async () => {
    arrange(mockRequest());
    arrangeCandidates([{ _id: PROFILE_ID, status: 'ready' }]);

    await putInternsForward(admin, REQUEST_ID, POSITION_ID, { internProfileIds: [PROFILE_ID] });

    expect(Recommendation.find).toHaveBeenCalledWith(
      expect.objectContaining({
        position: POSITION_ID,
        status: { $in: ['recommended', 'interviewing'] },
      })
    );
  });

  // Putting an already-placed intern forward is a deliberate act the admin was
  // warned about, not a slip to block.
  it('allows an already-placed intern through', async () => {
    arrange(mockRequest());
    arrangeCandidates([{ _id: PROFILE_ID, status: 'placed' }]);

    await putInternsForward(admin, REQUEST_ID, POSITION_ID, { internProfileIds: [PROFILE_ID] });

    expect(createRecommendationsForStaffingRequest).toHaveBeenCalled();
  });
});

describe('closeStaffingRequest', () => {
  it('writes the close markers and returns the formatted request', async () => {
    const doc = arrange(mockRequest());
    const result = await closeStaffingRequest(admin, REQUEST_ID, { reason: 'fulfilled' });

    expect(doc.status).toBe('closed');
    expect(doc.reason).toBe('fulfilled');
    expect(String(doc.closedBy)).toBe(ADMIN_ID);
    expect(doc.closedAt).toBeInstanceOf(Date);
    expect(doc.save).toHaveBeenCalled();
    expect(result).toMatchObject({ id: REQUEST_ID, status: 'closed', reason: 'fulfilled' });
    expect(result.progress.totals).toEqual({
      wanted: 2,
      putForward: 0,
      inSelection: 0,
      placed: 0,
    });
  });

  it('routes a cancellation reason to closeNote, never to the admin note', async () => {
    const doc = arrange(mockRequest({ note: 'Existing admin remark' }));
    await closeStaffingRequest(author, REQUEST_ID, {
      reason: 'cancelled',
      note: '  Client pulled out  ',
    });

    expect(doc.closeNote).toBe('Client pulled out');
    expect(doc.note).toBe('Existing admin remark');
    expect(doc.noteBy).toBeUndefined();
  });

  it('routes a decline note to the admin note with attribution', async () => {
    const doc = arrange(mockRequest());
    await closeStaffingRequest(admin, REQUEST_ID, { reason: 'declined', note: 'No capacity' });

    expect(doc.note).toBe('No capacity');
    expect(String(doc.noteBy)).toBe(ADMIN_ID);
    expect(doc.noteAt).toBeInstanceOf(Date);
    expect(doc.closeNote).toBe('');
  });

  it('writes an optional note on a fulfil, and leaves it alone when absent', async () => {
    const withNote = arrange(mockRequest());
    await closeStaffingRequest(admin, REQUEST_ID, {
      reason: 'fulfilled',
      note: 'Both start 1 Oct',
    });
    expect(withNote.note).toBe('Both start 1 Oct');
    expect(String(withNote.noteBy)).toBe(ADMIN_ID);

    const withoutNote = arrange(mockRequest({ note: 'Existing admin remark' }));
    await closeStaffingRequest(admin, REQUEST_ID, { reason: 'fulfilled' });
    expect(withoutNote.note).toBe('Existing admin remark');
  });

  it('rejects a leadership author closing as fulfilled with 403, not 400', async () => {
    const doc = arrange(mockRequest());
    await expectHttpError(closeStaffingRequest(author, REQUEST_ID, { reason: 'fulfilled' }), 403);
    expect(doc.save).not.toHaveBeenCalled();
  });

  it('rejects a decline with no note as 400', async () => {
    const doc = arrange(mockRequest());
    await expectHttpError(
      closeStaffingRequest(admin, REQUEST_ID, { reason: 'declined', note: '   ' }),
      400
    );
    expect(doc.save).not.toHaveBeenCalled();
  });

  it('rejects an unknown reason as 400', async () => {
    arrange(mockRequest());
    await expectHttpError(closeStaffingRequest(admin, REQUEST_ID, { reason: 'archived' }), 400);
  });

  it('rejects a missing reason as 400', async () => {
    arrange(mockRequest());
    await expectHttpError(closeStaffingRequest(admin, REQUEST_ID, {}), 400);
  });

  it('rejects closing an already-closed request as 400', async () => {
    arrange(mockRequest({ status: 'closed', reason: 'cancelled' }));
    await expectHttpError(closeStaffingRequest(admin, REQUEST_ID, { reason: 'fulfilled' }), 400);
  });

  it('rejects a leadership member who is not the author as 403', async () => {
    arrange(mockRequest());
    await expectHttpError(
      closeStaffingRequest(otherLeader, REQUEST_ID, { reason: 'cancelled' }),
      403
    );
  });

  it('404s an unknown request', async () => {
    StaffingRequest.findById.mockResolvedValue(null);
    await expectHttpError(closeStaffingRequest(admin, REQUEST_ID, { reason: 'fulfilled' }), 404);
  });

  it('400s a malformed id without hitting the database', async () => {
    await expectHttpError(closeStaffingRequest(admin, 'not-an-id', { reason: 'fulfilled' }), 400);
    expect(StaffingRequest.findById).not.toHaveBeenCalled();
  });
});

describe('reopenStaffingRequest', () => {
  it('clears every close marker and keeps the notes as the record', async () => {
    const doc = arrange(
      mockRequest({
        status: 'closed',
        reason: 'declined',
        closedBy: ADMIN_ID,
        closedAt: new Date('2026-07-01T00:00:00.000Z'),
        note: 'No capacity',
        noteBy: ADMIN_ID,
      })
    );
    await reopenStaffingRequest(author, REQUEST_ID);

    expect(doc.status).toBe('open');
    expect(doc.reason).toBeNull();
    expect(doc.closedBy).toBeNull();
    expect(doc.closedAt).toBeNull();
    expect(doc.note).toBe('No capacity');
    expect(doc.save).toHaveBeenCalled();
  });

  it('rejects reopening a request that is already open as 400', async () => {
    arrange(mockRequest());
    await expectHttpError(reopenStaffingRequest(admin, REQUEST_ID), 400);
  });

  it('rejects a leadership member who is not the author as 403', async () => {
    arrange(mockRequest({ status: 'closed', reason: 'cancelled' }));
    await expectHttpError(reopenStaffingRequest(otherLeader, REQUEST_ID), 403);
  });
});
