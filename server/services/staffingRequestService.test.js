// Wiring-level cover for the close / reopen paths. Who may close with which
// reason is decided by helpers/staffingRequestRules.js and tested there; what
// this checks is what the service does around that decision — which field the
// supplied note lands in per reason (they are not interchangeable), that the
// close markers are written and cleared, and that a "not you" refusal comes
// back as 403 while an illegal move comes back as 400. Mongo is mocked.

jest.mock('../models/StaffingRequest', () => ({ findById: jest.fn() }));
jest.mock('../models/Recommendation', () => ({ find: jest.fn() }));
jest.mock('../models/Project', () => ({ findById: jest.fn() }));
jest.mock('../models/Position', () => ({ findById: jest.fn() }));
jest.mock('../models/Technology', () => ({ find: jest.fn() }));

const StaffingRequest = require('../models/StaffingRequest');
const Recommendation = require('../models/Recommendation');
const { ROLES } = require('../constants/roles');
const { closeStaffingRequest, reopenStaffingRequest } = require('./staffingRequestService');

const REQUEST_ID = '507f1f77bcf86cd799439011';
const AUTHOR_ID = '507f1f77bcf86cd799439012';
const ADMIN_ID = '507f1f77bcf86cd799439013';

const author = { _id: AUTHOR_ID, role: ROLES.LEADERSHIP };
const admin = { _id: ADMIN_ID, role: ROLES.ADMIN };
const otherLeader = { _id: '507f1f77bcf86cd799439014', role: ROLES.LEADERSHIP };

// A stand-in for the Mongoose document: real enough for the service (save,
// populate, toObject, assignable fields), with none of the model's validation —
// that the model accepts what we write here is the model's own contract.
const mockRequest = (overrides = {}) => {
  const doc = {
    _id: REQUEST_ID,
    project: '507f1f77bcf86cd799439015',
    author: AUTHOR_ID,
    status: 'open',
    reason: undefined,
    note: '',
    closeNote: '',
    requestedPositions: [{ position: '507f1f77bcf86cd799439016', count: 2, technologies: [] }],
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
    expect(result.progress.totals).toEqual({ wanted: 2, putForward: 0, placed: 0 });
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
