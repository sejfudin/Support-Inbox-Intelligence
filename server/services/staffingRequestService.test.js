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
const { emitStaffingNewsChanged } = require('../socket/events');
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
const OTHER_POSITION_ID = '507f1f77bcf86cd79943901a';
const OTHER_TECHNOLOGY_ID = '507f1f77bcf86cd79943901b';

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

const arrange = (doc, tagged = []) => {
  StaffingRequest.findById.mockResolvedValue(doc);
  Recommendation.find.mockReturnValue({
    select: () => ({
      lean: async () => tagged,
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

  const twoPositionRequest = () =>
    mockRequest({
      requestedPositions: [
        { position: POSITION_ID, count: 2, technologies: [TECHNOLOGY_ID] },
        { position: OTHER_POSITION_ID, count: 1, technologies: [OTHER_TECHNOLOGY_ID] },
      ],
    });

  const submit = (groups) => putInternsForward(admin, REQUEST_ID, { groups });
  const oneGroup = [{ positionId: POSITION_ID, internProfileIds: [PROFILE_ID] }];

  it('creates recommendations tagged to the request, with the position forced', async () => {
    const doc = arrange(mockRequest());
    arrangeCandidates([
      { _id: PROFILE_ID, status: 'ready' },
      { _id: OTHER_PROFILE_ID, status: 'ready' },
    ]);

    await submit([{ positionId: POSITION_ID, internProfileIds: [PROFILE_ID, OTHER_PROFILE_ID] }]);

    expect(createRecommendationsForStaffingRequest).toHaveBeenCalledWith(admin, {
      groups: [
        {
          positionId: POSITION_ID,
          internProfileIds: [PROFILE_ID, OTHER_PROFILE_ID],
          technologyIds: [TECHNOLOGY_ID],
        },
      ],
      projectId: doc.project,
      staffingRequestId: REQUEST_ID,
    });
  });

  // One submit is one answer, however many seats it spans: one insert, one
  // event naming the total, one badge.
  it('sends a cart spanning two positions as a single write', async () => {
    arrange(twoPositionRequest());
    arrangeCandidates([
      { _id: PROFILE_ID, status: 'ready' },
      { _id: OTHER_PROFILE_ID, status: 'ready' },
    ]);

    await submit([
      { positionId: POSITION_ID, internProfileIds: [PROFILE_ID] },
      { positionId: OTHER_POSITION_ID, internProfileIds: [OTHER_PROFILE_ID] },
    ]);

    expect(createRecommendationsForStaffingRequest).toHaveBeenCalledTimes(1);
    expect(createRecommendationsForStaffingRequest.mock.calls[0][1].groups).toHaveLength(2);
    expect(logStaffingRequestEvent).toHaveBeenCalledTimes(1);
    expect(logStaffingRequestEvent.mock.calls[0][0].action).toMatch(/^2 put forward for /);
    expect(emitStaffingNewsChanged).toHaveBeenCalledTimes(1);
  });

  it('appends a history event so the other side is badged', async () => {
    arrange(mockRequest());
    arrangeCandidates([{ _id: PROFILE_ID, status: 'ready' }]);

    await submit(oneGroup);

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

    await submit([{ positionId: POSITION_ID, internProfileIds: [PROFILE_ID, OTHER_PROFILE_ID] }]);

    expect(createRecommendationsForStaffingRequest).toHaveBeenCalled();
  });

  it('refuses a non-admin with a 403', async () => {
    arrange(mockRequest());
    await expectHttpError(putInternsForward(author, REQUEST_ID, { groups: oneGroup }), 403);
    expect(createRecommendationsForStaffingRequest).not.toHaveBeenCalled();
  });

  it('refuses a request whose draft project is unresolved', async () => {
    arrange(mockRequest({ project: null, draftProject: { name: 'Kestrel' } }));
    await expectHttpError(submit(oneGroup), 400);
  });

  it('refuses a closed request', async () => {
    arrange(mockRequest({ status: 'closed', reason: 'cancelled' }));
    await expectHttpError(submit(oneGroup), 400);
  });

  // The position is not a free choice in this flow: it must be one this
  // request actually asked for, even though it now arrives in the body.
  it('refuses a position that is not on the request', async () => {
    arrange(mockRequest());
    await expectHttpError(
      submit([{ positionId: OTHER_POSITION_ID, internProfileIds: [PROFILE_ID] }]),
      400
    );
  });

  it('refuses an empty cart', async () => {
    arrange(mockRequest());
    await expectHttpError(putInternsForward(admin, REQUEST_ID, {}), 400);
    await expectHttpError(submit([{ positionId: POSITION_ID, internProfileIds: [] }]), 400);
  });

  // The picker rules hold server-side, not only in the UI — a cart goes stale
  // between staging and submit.
  it('refuses an intern who has left the programme, naming the row', async () => {
    arrange(mockRequest());
    arrangeCandidates([{ _id: PROFILE_ID, status: 'discontinued' }]);

    await expect(submit(oneGroup)).rejects.toMatchObject({
      statusCode: 409,
      data: {
        rejections: [{ positionId: POSITION_ID, internProfileId: PROFILE_ID }],
      },
    });
    expect(createRecommendationsForStaffingRequest).not.toHaveBeenCalled();
  });

  // All-or-nothing: the good pick in the other group is not created either.
  it('creates nothing when one pick in a two-position cart is stale', async () => {
    arrange(twoPositionRequest());
    arrangeCandidates([
      { _id: PROFILE_ID, status: 'ready' },
      { _id: OTHER_PROFILE_ID, status: 'discontinued' },
    ]);

    await expect(
      submit([
        { positionId: POSITION_ID, internProfileIds: [PROFILE_ID] },
        { positionId: OTHER_POSITION_ID, internProfileIds: [OTHER_PROFILE_ID] },
      ])
    ).rejects.toMatchObject({
      statusCode: 409,
      data: { rejections: [{ positionId: OTHER_POSITION_ID }] },
    });
    expect(createRecommendationsForStaffingRequest).not.toHaveBeenCalled();
    expect(logStaffingRequestEvent).not.toHaveBeenCalled();
  });

  // One seat per intern per request: the same person cannot answer two of its
  // seats. Only a request-level submit can break this rule.
  it('refuses the same intern staged on two seats of one request', async () => {
    arrange(twoPositionRequest());
    arrangeCandidates([{ _id: PROFILE_ID, status: 'ready' }]);

    await expect(
      submit([
        { positionId: POSITION_ID, internProfileIds: [PROFILE_ID] },
        { positionId: OTHER_POSITION_ID, internProfileIds: [PROFILE_ID] },
      ])
    ).rejects.toMatchObject({
      statusCode: 409,
      data: { rejections: [{ positionId: OTHER_POSITION_ID, internProfileId: PROFILE_ID }] },
    });
  });

  // A stale pick is reported against its own row, so the admin drops that one
  // rather than being told the whole submit was wrong.
  it('reports every stale pick, not just the first', async () => {
    arrange(mockRequest());
    arrangeCandidates([
      { _id: PROFILE_ID, status: 'discontinued' },
      { _id: OTHER_PROFILE_ID, status: 'completed' },
    ]);

    await expect(
      submit([{ positionId: POSITION_ID, internProfileIds: [PROFILE_ID, OTHER_PROFILE_ID] }])
    ).rejects.toMatchObject({
      data: {
        rejections: [
          { internProfileId: PROFILE_ID, reason: 'Has left the programme' },
          { internProfileId: OTHER_PROFILE_ID, reason: 'Has completed the programme' },
        ],
      },
    });
  });

  // Only LIVE tags exclude. Someone whose process here fell through is a
  // legitimate pick again — `Recommendation.find` is called with a status
  // filter, so a resolved tag never reaches the picker rules at all.
  it('looks only at still-live tags when refusing a duplicate', async () => {
    arrange(mockRequest());
    arrangeCandidates([{ _id: PROFILE_ID, status: 'ready' }]);

    await submit(oneGroup);

    expect(Recommendation.find).toHaveBeenCalledWith(
      expect.objectContaining({
        position: { $in: [POSITION_ID] },
        status: { $in: ['recommended', 'interviewing'] },
      })
    );
  });

  it('refuses an intern already in selection for that seat', async () => {
    arrange(mockRequest(), [{ internProfile: PROFILE_ID, position: POSITION_ID }]);
    arrangeCandidates([{ _id: PROFILE_ID, status: 'ready' }]);

    await expect(submit(oneGroup)).rejects.toMatchObject({
      statusCode: 409,
      data: {
        rejections: [{ reason: 'Already in selection for this position' }],
      },
    });
  });

  // Putting an already-placed intern forward is a deliberate act the admin was
  // warned about, not a slip to block.
  it('allows an already-placed intern through', async () => {
    arrange(mockRequest());
    arrangeCandidates([{ _id: PROFILE_ID, status: 'placed' }]);

    await submit(oneGroup);

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
