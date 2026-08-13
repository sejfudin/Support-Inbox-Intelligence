// Wiring-level cover for the close / note / put-forward paths. Who may do what
// is decided by helpers/staffingRequestRules.js and tested there; what this
// checks is what the service does around those decisions — which field the
// supplied note lands in per reason (they are not interchangeable), that the
// close markers are written, that closing runs the close-out cascade and names
// its consequence in the trail, that putting interns forward creates
// recommendations tagged to the request with the position forced, and that a
// "not you" refusal comes back as 403 while an illegal move comes back as 400.
// Mongo is mocked.

jest.mock('../models/StaffingRequest', () => ({ findById: jest.fn() }));
jest.mock('../models/Recommendation', () => ({ find: jest.fn(), updateMany: jest.fn() }));
jest.mock('../models/Project', () => ({ findById: jest.fn() }));
jest.mock('../models/Position', () => ({
  findById: jest.fn(),
  exists: jest.fn(),
  find: jest.fn(),
}));
jest.mock('../models/Technology', () => ({ find: jest.fn() }));
jest.mock('../models/InternProfile', () => ({ find: jest.fn() }));
// Not just isolation: requiring the real recommendationService pulls in
// Supabase config, which throws without env.
jest.mock('./recommendationService', () => ({
  createRecommendationsForStaffingRequest: jest.fn().mockResolvedValue([]),
  closeOutRecommendationsForDemandEnd: jest.fn().mockResolvedValue({ closedOutCount: 0 }),
}));
jest.mock('./historyService', () => ({ logStaffingRequestEvent: jest.fn().mockResolvedValue() }));
jest.mock('../socket/events', () => ({
  emitStaffingNewsChanged: jest.fn(),
  emitInternDataChanged: jest.fn(),
}));

const StaffingRequest = require('../models/StaffingRequest');
const Recommendation = require('../models/Recommendation');
const Position = require('../models/Position');
const Project = require('../models/Project');
const InternProfile = require('../models/InternProfile');
const {
  createRecommendationsForStaffingRequest,
  closeOutRecommendationsForDemandEnd,
} = require('./recommendationService');
const { logStaffingRequestEvent } = require('./historyService');
const { emitStaffingNewsChanged } = require('../socket/events');
const { ROLES } = require('../constants/roles');
const {
  closeStaffingRequest,
  setStaffingRequestNote,
  putInternsForward,
  updateStaffingRequest,
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
  closeOutRecommendationsForDemandEnd.mockResolvedValue({ closedOutCount: 0 });
});

// A recommendation as the close path sees it: tagged to the request, with a
// position and a pipeline status. In selection unless told otherwise.
const tagged = ({ position = POSITION_ID, status = 'interviewing' } = {}) => ({ position, status });

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

  it('rejects an admin cancelling with 403 — the withdrawal is leadership’s', async () => {
    const doc = arrange(mockRequest());
    await expectHttpError(closeStaffingRequest(admin, REQUEST_ID, { reason: 'cancelled' }), 403);
    expect(doc.save).not.toHaveBeenCalled();
  });

  // Cancelling belongs to leadership as a side, not to whoever's name is on the
  // request — the author may well have left by the time the client pulls out.
  it('lets a leadership member who is not the author cancel', async () => {
    const doc = arrange(mockRequest());
    await closeStaffingRequest(otherLeader, REQUEST_ID, { reason: 'cancelled' });

    expect(doc.status).toBe('closed');
    expect(doc.reason).toBe('cancelled');
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

  it('404s an unknown request', async () => {
    StaffingRequest.findById.mockResolvedValue(null);
    await expectHttpError(closeStaffingRequest(admin, REQUEST_ID, { reason: 'fulfilled' }), 404);
  });

  it('400s a malformed id without hitting the database', async () => {
    await expectHttpError(closeStaffingRequest(admin, 'not-an-id', { reason: 'fulfilled' }), 400);
    expect(StaffingRequest.findById).not.toHaveBeenCalled();
  });

  // The not-placed reason is required by the request's own state, not by the
  // payload: whoever closes has to answer for the candidates they end.
  it('rejects a close with candidates in selection and no not-placed reason as 400', async () => {
    const doc = arrange(mockRequest(), [tagged(), tagged()]);
    await expectHttpError(closeStaffingRequest(admin, REQUEST_ID, { reason: 'fulfilled' }), 400);
    expect(doc.save).not.toHaveBeenCalled();
    expect(closeOutRecommendationsForDemandEnd).not.toHaveBeenCalled();
  });

  it('ignores a tagged recommendation whose position the request no longer asks for', async () => {
    const doc = arrange(mockRequest(), [tagged({ position: OTHER_POSITION_ID })]);
    await closeStaffingRequest(admin, REQUEST_ID, { reason: 'fulfilled' });
    expect(doc.status).toBe('closed');
  });

  it('runs the cascade with the shared reason and every requested position', async () => {
    closeOutRecommendationsForDemandEnd.mockResolvedValue({ closedOutCount: 4 });
    arrange(mockRequest(), [tagged()]);
    await closeStaffingRequest(otherLeader, REQUEST_ID, {
      reason: 'cancelled',
      notPlacedReason: '  The client withdrew the ask  ',
    });

    expect(closeOutRecommendationsForDemandEnd).toHaveBeenCalledWith(
      otherLeader,
      expect.objectContaining({
        staffingRequestId: REQUEST_ID,
        positionIds: [POSITION_ID],
        reason: 'The client withdrew the ask',
      })
    );
  });

  it('appends a history event naming the consequence, and badges the other side', async () => {
    closeOutRecommendationsForDemandEnd.mockResolvedValue({ closedOutCount: 4 });
    arrange(mockRequest(), [tagged()]);
    await closeStaffingRequest(otherLeader, REQUEST_ID, {
      reason: 'cancelled',
      notPlacedReason: 'The client withdrew the ask',
    });

    expect(logStaffingRequestEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: REQUEST_ID,
        userId: otherLeader._id,
        action: 'Cancelled — 4 interns closed out',
        statusKey: 'staffing:closed',
      })
    );
    expect(emitStaffingNewsChanged).toHaveBeenCalled();
  });

  it('names one intern in the singular', async () => {
    closeOutRecommendationsForDemandEnd.mockResolvedValue({ closedOutCount: 1 });
    arrange(mockRequest(), [tagged()]);
    await closeStaffingRequest(admin, REQUEST_ID, {
      reason: 'declined',
      note: 'No capacity',
      notPlacedReason: 'We could not staff this',
    });

    expect(logStaffingRequestEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'Declined — 1 intern closed out' })
    );
  });

  it('logs the bare verb when the close ended nobody’s process', async () => {
    arrange(mockRequest());
    await closeStaffingRequest(admin, REQUEST_ID, { reason: 'fulfilled' });

    expect(logStaffingRequestEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'Closed as fulfilled' })
    );
  });
});

// Notes are the one write a closed request still accepts: with no reopen, this
// is the only way to annotate a mis-close or cross-reference a refiling.
describe('setStaffingRequestNote', () => {
  it('writes a note onto a closed request', async () => {
    const doc = arrange(mockRequest({ status: 'closed', reason: 'cancelled' }));
    await setStaffingRequestNote(admin, REQUEST_ID, {
      note: '  Cancelled in error, refiled as #52  ',
    });

    expect(doc.note).toBe('Cancelled in error, refiled as #52');
    expect(String(doc.noteBy)).toBe(ADMIN_ID);
    expect(doc.noteAt).toBeInstanceOf(Date);
    expect(doc.save).toHaveBeenCalled();
  });

  it('appends a history event and badges the other side', async () => {
    arrange(mockRequest());
    await setStaffingRequestNote(admin, REQUEST_ID, { note: 'Two interviews booked' });

    expect(logStaffingRequestEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'Note added', statusKey: 'staffing:note' })
    );
    expect(emitStaffingNewsChanged).toHaveBeenCalled();
  });

  it('rejects leadership writing a note as 403', async () => {
    const doc = arrange(mockRequest());
    await expectHttpError(setStaffingRequestNote(author, REQUEST_ID, { note: 'Mine now' }), 403);
    expect(doc.save).not.toHaveBeenCalled();
  });

  it('rejects an empty note as 400', async () => {
    arrange(mockRequest());
    await expectHttpError(setStaffingRequestNote(admin, REQUEST_ID, { note: '   ' }), 400);
  });
});

// The edit path (ticket 10). Legality is the rules helper's and tested there;
// what matters here is that the service carries out the consequences the plan
// reports — the close-out cascade for a position that stopped being asked for,
// the recommendation move behind a project change — and names each of them in
// the trail.
describe('updateStaffingRequest', () => {
  const OTHER_PROJECT_ID = '507f1f77bcf86cd79943901c';
  const THIRD_POSITION_ID = '507f1f77bcf86cd79943901d';

  // The update path reads recommendations through the populate chain, resolves
  // the new project, and looks position names up for the trail line.
  const arrangeEdit = (doc, taggedRecommendations = []) => {
    StaffingRequest.findById.mockResolvedValue(doc);
    Recommendation.find.mockReturnValue({
      select: () => ({
        lean: async () => taggedRecommendations,
        populate: () => ({ populate: () => ({ lean: async () => taggedRecommendations }) }),
      }),
    });
    Recommendation.updateMany.mockResolvedValue({ modifiedCount: taggedRecommendations.length });
    Position.exists.mockResolvedValue(true);
    Position.find.mockReturnValue({
      select: () => ({
        lean: async () => [
          { _id: POSITION_ID, name: 'Frontend' },
          { _id: OTHER_POSITION_ID, name: 'Backend' },
          { _id: THIRD_POSITION_ID, name: 'QA' },
        ],
      }),
    });
    Project.findById.mockReturnValue({
      select: async () => ({ _id: OTHER_PROJECT_ID, name: 'Borealis' }),
    });
    return doc;
  };

  const editable = (overrides = {}) =>
    mockRequest({
      requestedPositions: [
        { position: { _id: POSITION_ID, name: 'Frontend' }, count: 2, technologies: [] },
      ],
      ...overrides,
    });

  const line = (position, count = 2, technologies = []) => ({ position, count, technologies });

  // `staffingRequest` matters: loadTaggedRecommendations groups by it, so a
  // recommendation without one never reaches the plan.
  const inSelection = (position = POSITION_ID) => ({
    staffingRequest: REQUEST_ID,
    position,
    status: 'interviewing',
    result: {},
  });
  const placed = (name, position = POSITION_ID) => ({
    staffingRequest: REQUEST_ID,
    position,
    status: 'resulted',
    result: { outcome: 'placed' },
    internProfile: { user: { fullname: name } },
  });

  it('closes out the candidates of a position that stopped being asked for', async () => {
    closeOutRecommendationsForDemandEnd.mockResolvedValue({ closedOutCount: 1 });
    arrangeEdit(editable(), [inSelection()]);

    await updateStaffingRequest(author, REQUEST_ID, {
      requestedPositions: [line(OTHER_POSITION_ID)],
      notPlacedReason: 'The client moved the work to Backend',
    });

    expect(closeOutRecommendationsForDemandEnd).toHaveBeenCalledWith(
      author,
      expect.objectContaining({
        staffingRequestId: REQUEST_ID,
        positionIds: [POSITION_ID],
        reason: 'The client moved the work to Backend',
      })
    );
    expect(logStaffingRequestEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'Frontend line changed to Backend — 1 intern closed out',
        statusKey: 'staffing:positions_changed',
      })
    );
    expect(emitStaffingNewsChanged).toHaveBeenCalled();
  });

  it('refuses to close candidates out without a reason', async () => {
    const doc = arrangeEdit(editable(), [inSelection()]);

    await expectHttpError(
      updateStaffingRequest(author, REQUEST_ID, { requestedPositions: [line(OTHER_POSITION_ID)] }),
      400
    );
    expect(doc.save).not.toHaveBeenCalled();
    expect(closeOutRecommendationsForDemandEnd).not.toHaveBeenCalled();
  });

  it('refuses to end a position someone is placed against, as a 400 naming the intern', async () => {
    arrangeEdit(editable(), [placed('Ana')]);

    await expect(
      updateStaffingRequest(author, REQUEST_ID, { requestedPositions: [line(OTHER_POSITION_ID)] })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Frontend can't be changed, Ana is already placed against it",
    });
  });

  it('runs no cascade when a count is merely lowered', async () => {
    const doc = arrangeEdit(editable(), [inSelection(), inSelection()]);

    await updateStaffingRequest(author, REQUEST_ID, {
      requestedPositions: [line(POSITION_ID, 1)],
    });

    expect(closeOutRecommendationsForDemandEnd).not.toHaveBeenCalled();
    expect(doc.save).toHaveBeenCalled();
    expect(logStaffingRequestEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'Request edited — counts', statusKey: 'staffing:edited' })
    );
  });

  it('moves every tagged recommendation with a project change and names the count', async () => {
    const doc = arrangeEdit(editable({ project: { _id: PROJECT_ID, name: 'Atlas' } }), [
      inSelection(),
      placed('Ana'),
    ]);
    // Only the second populate is REQUEST_POPULATE — the first runs before the
    // plan, and moving the project there would hide the change from it.
    let populateCalls = 0;
    doc.populate = jest.fn().mockImplementation(async () => {
      populateCalls += 1;
      if (populateCalls > 1) doc.project = { _id: OTHER_PROJECT_ID, name: 'Borealis' };
    });

    await updateStaffingRequest(author, REQUEST_ID, { projectId: OTHER_PROJECT_ID });

    expect(Recommendation.updateMany).toHaveBeenCalledWith(
      { staffingRequest: REQUEST_ID },
      expect.objectContaining({ $set: expect.objectContaining({ project: OTHER_PROJECT_ID }) })
    );
    expect(logStaffingRequestEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'Project changed to Borealis — 2 recommendations moved',
        statusKey: 'staffing:project_changed',
      })
    );
  });

  it('names no position change when the payload leaves the ask alone', async () => {
    const doc = arrangeEdit(editable({ project: { _id: PROJECT_ID, name: 'Atlas' } }));
    let populateCalls = 0;
    doc.populate = jest.fn().mockImplementation(async () => {
      populateCalls += 1;
      if (populateCalls > 1) doc.project = { _id: OTHER_PROJECT_ID, name: 'Borealis' };
    });

    await updateStaffingRequest(author, REQUEST_ID, { projectId: OTHER_PROJECT_ID });

    expect(logStaffingRequestEvent).toHaveBeenCalledTimes(1);
    expect(logStaffingRequestEvent).toHaveBeenCalledWith(
      expect.objectContaining({ statusKey: 'staffing:project_changed' })
    );
  });

  it('names both lines when an edit removes more than one position', async () => {
    closeOutRecommendationsForDemandEnd.mockResolvedValue({ closedOutCount: 0 });
    const doc = editable({
      requestedPositions: [
        { position: { _id: POSITION_ID, name: 'Frontend' }, count: 2, technologies: [] },
        { position: { _id: OTHER_POSITION_ID, name: 'Backend' }, count: 1, technologies: [] },
      ],
    });
    arrangeEdit(doc);

    await updateStaffingRequest(author, REQUEST_ID, {
      requestedPositions: [line(THIRD_POSITION_ID)],
    });

    expect(logStaffingRequestEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'Positions changed: Frontend, Backend → QA' })
    );
  });

  it('records what the draft details said before and after', async () => {
    arrangeEdit(editable({ draftProject: { name: 'Kestrel', client: '', description: '' } }));

    await updateStaffingRequest(author, REQUEST_ID, {
      draftProject: { name: 'Kestrel II' },
    });

    expect(logStaffingRequestEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'Draft project details edited — name "Kestrel" → "Kestrel II"',
      })
    );
  });

  it('rejects an admin as 403 — answering a request is not restating it', async () => {
    const doc = arrangeEdit(editable());
    await expectHttpError(
      updateStaffingRequest(admin, REQUEST_ID, { requestedPositions: [line(POSITION_ID, 3)] }),
      403
    );
    expect(doc.save).not.toHaveBeenCalled();
  });

  it('rejects a leadership user who is not the author as 403', async () => {
    const doc = arrangeEdit(editable());
    await expectHttpError(
      updateStaffingRequest(otherLeader, REQUEST_ID, {
        requestedPositions: [line(POSITION_ID, 3)],
      }),
      403
    );
    expect(doc.save).not.toHaveBeenCalled();
  });

  it('logs nothing when the edit changes nothing', async () => {
    arrangeEdit(editable());

    await updateStaffingRequest(author, REQUEST_ID, { requestedPositions: [line(POSITION_ID, 2)] });

    expect(logStaffingRequestEvent).not.toHaveBeenCalled();
    expect(emitStaffingNewsChanged).not.toHaveBeenCalled();
  });

  it('edits draft project details after resolution and logs it', async () => {
    const doc = arrangeEdit(
      editable({ draftProject: { name: 'Kestrel', client: '', description: '' } })
    );

    await updateStaffingRequest(author, REQUEST_ID, {
      draftProject: { name: 'Kestrel II', client: 'Northwind' },
    });

    expect(doc.draftProject).toMatchObject({ name: 'Kestrel II', client: 'Northwind' });
    expect(logStaffingRequestEvent).toHaveBeenCalledWith(
      expect.objectContaining({ statusKey: 'staffing:draft_edited' })
    );
  });
});
