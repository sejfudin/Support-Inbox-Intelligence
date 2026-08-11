const {
  deriveProgress,
  assertProjectEditable,
  assertRequestedPositionsEditable,
  assertCanClose,
  applyClose,
  assertCanReopen,
  applyReopen,
} = require('./staffingRequestRules');

const FRONTEND = 'position-frontend';
const QA = 'position-qa';
const OTHER = 'position-other';
const PROJECT = 'project-kestrel';
const AUTHOR = 'user-leadership';
const ADMIN = 'user-admin';
const CLOSED_AT = new Date('2026-02-01T00:00:00.000Z');

const requestedPosition = (overrides = {}) => ({
  position: FRONTEND,
  count: 2,
  technologies: [],
  ...overrides,
});

const recommendation = ({ position = FRONTEND, outcome } = {}) => ({
  position,
  result: outcome ? { outcome } : {},
});

const baseRequest = (overrides = {}) => ({
  project: PROJECT,
  draftProject: null,
  author: AUTHOR,
  status: 'open',
  reason: undefined,
  ...overrides,
});

describe('deriveProgress', () => {
  it('reports zero put forward and placed when nothing has been offered', () => {
    const progress = deriveProgress([requestedPosition({ count: 2 })], []);
    expect(progress).toEqual({
      positions: [{ position: FRONTEND, wanted: 2, putForward: 0, placed: 0 }],
      totals: { wanted: 2, putForward: 0, placed: 0 },
    });
  });

  it('counts over-supply beyond the wanted count', () => {
    const recs = Array.from({ length: 6 }, () => recommendation({ outcome: 'placed' }));
    const progress = deriveProgress([requestedPosition({ count: 3 })], recs);
    expect(progress).toEqual({
      positions: [{ position: FRONTEND, wanted: 3, putForward: 6, placed: 6 }],
      totals: { wanted: 3, putForward: 6, placed: 6 },
    });
  });

  it('separates placed from not-yet-resulted recommendations', () => {
    const recs = [
      recommendation({ outcome: 'placed' }),
      recommendation({ outcome: 'not_placed' }),
      recommendation({ outcome: undefined }),
    ];
    const progress = deriveProgress([requestedPosition({ count: 2 })], recs);
    expect(progress.positions[0]).toEqual({
      position: FRONTEND,
      wanted: 2,
      putForward: 3,
      placed: 1,
    });
  });

  it('ignores a recommendation whose position is not in the request', () => {
    const recs = [recommendation({ position: OTHER, outcome: 'placed' })];
    const progress = deriveProgress([requestedPosition({ count: 2 })], recs);
    expect(progress).toEqual({
      positions: [{ position: FRONTEND, wanted: 2, putForward: 0, placed: 0 }],
      totals: { wanted: 2, putForward: 0, placed: 0 },
    });
  });

  it('reflects a count lowered below the already-placed number', () => {
    const recs = [recommendation({ outcome: 'placed' }), recommendation({ outcome: 'placed' })];
    const progress = deriveProgress([requestedPosition({ count: 1 })], recs);
    expect(progress.positions[0]).toEqual({
      position: FRONTEND,
      wanted: 1,
      putForward: 2,
      placed: 2,
    });
  });

  it('derives totals across multiple requested positions', () => {
    const recs = [
      recommendation({ position: FRONTEND, outcome: 'placed' }),
      recommendation({ position: QA, outcome: 'not_placed' }),
    ];
    const progress = deriveProgress(
      [
        requestedPosition({ position: FRONTEND, count: 1 }),
        requestedPosition({ position: QA, count: 1 }),
      ],
      recs
    );
    expect(progress.totals).toEqual({ wanted: 2, putForward: 2, placed: 1 });
  });

  // The service populates `requestedPositions.position` so the UI has a name to
  // show, which means this helper receives a document on one side and a raw id
  // on the other. Comparing them with String() yields '[object Object]' vs a hex
  // id — every count silently reads 0, which is exactly what happened until a
  // fixture with tagged recommendations existed to catch it.
  it('matches a populated requested position against a raw recommendation id', () => {
    const progress = deriveProgress(
      [{ position: { _id: FRONTEND, name: 'Frontend Engineer' }, count: 2, technologies: [] }],
      [recommendation({ outcome: 'placed' }), recommendation({ outcome: undefined })]
    );
    expect(progress.totals).toEqual({ wanted: 2, putForward: 2, placed: 1 });
  });

  it('reports the position as an id even when it arrived populated', () => {
    const progress = deriveProgress(
      [{ position: { _id: FRONTEND, name: 'Frontend Engineer' }, count: 1, technologies: [] }],
      []
    );
    expect(progress.positions[0].position).toBe(FRONTEND);
  });
});

describe('assertProjectEditable', () => {
  it('allows editing the project when no recommendations exist', () => {
    expect(() => assertProjectEditable(baseRequest(), { hasRecommendations: false })).not.toThrow();
  });

  it('locks the project once recommendations exist', () => {
    expect(() => assertProjectEditable(baseRequest(), { hasRecommendations: true })).toThrow();
  });

  it('rejects any edit on a closed request', () => {
    const request = baseRequest({ status: 'closed', reason: 'cancelled' });
    expect(() => assertProjectEditable(request, { hasRecommendations: false })).toThrow();
  });
});

describe('assertRequestedPositionsEditable', () => {
  it('allows a legal set of requested positions', () => {
    expect(() =>
      assertRequestedPositionsEditable(baseRequest(), [
        requestedPosition({ position: FRONTEND }),
        requestedPosition({ position: QA }),
      ])
    ).not.toThrow();
  });

  it('rejects a duplicate position', () => {
    expect(() =>
      assertRequestedPositionsEditable(baseRequest(), [
        requestedPosition({ position: FRONTEND }),
        requestedPosition({ position: FRONTEND }),
      ])
    ).toThrow();
  });

  it('rejects a count below 1', () => {
    expect(() =>
      assertRequestedPositionsEditable(baseRequest(), [requestedPosition({ count: 0 })])
    ).toThrow();
  });

  it('rejects deleting a requested position that has recommendations', () => {
    expect(() =>
      assertRequestedPositionsEditable(
        baseRequest(),
        [requestedPosition({ position: QA })],
        [FRONTEND]
      )
    ).toThrow();
  });

  it('allows lowering the count of a requested position with recommendations', () => {
    expect(() =>
      assertRequestedPositionsEditable(
        baseRequest(),
        [requestedPosition({ position: FRONTEND, count: 1 })],
        [FRONTEND]
      )
    ).not.toThrow();
  });

  it('rejects every edit on a closed request', () => {
    const request = baseRequest({ status: 'closed', reason: 'cancelled' });
    expect(() =>
      assertRequestedPositionsEditable(request, [requestedPosition({ position: FRONTEND })])
    ).toThrow();
  });
});

describe('assertCanClose', () => {
  it('allows the author to cancel', () => {
    expect(() =>
      assertCanClose(baseRequest(), { isAdmin: false, isAuthor: true, reason: 'cancelled' })
    ).not.toThrow();
  });

  it('allows an admin to cancel someone else’s request', () => {
    expect(() =>
      assertCanClose(baseRequest(), { isAdmin: true, isAuthor: false, reason: 'cancelled' })
    ).not.toThrow();
  });

  it('rejects cancel from a non-author, non-admin', () => {
    expect(() =>
      assertCanClose(baseRequest(), { isAdmin: false, isAuthor: false, reason: 'cancelled' })
    ).toThrow();
  });

  it('rejects a non-admin closing as fulfilled', () => {
    expect(() =>
      assertCanClose(baseRequest(), { isAdmin: false, isAuthor: true, reason: 'fulfilled' })
    ).toThrow();
  });

  it('allows an admin to close as fulfilled', () => {
    expect(() =>
      assertCanClose(baseRequest(), { isAdmin: true, isAuthor: false, reason: 'fulfilled' })
    ).not.toThrow();
  });

  it('rejects declined with no note', () => {
    expect(() =>
      assertCanClose(baseRequest(), {
        isAdmin: true,
        isAuthor: false,
        reason: 'declined',
        note: '  ',
      })
    ).toThrow();
  });

  it('allows declined with a non-empty note', () => {
    expect(() =>
      assertCanClose(baseRequest(), {
        isAdmin: true,
        isAuthor: false,
        reason: 'declined',
        note: 'No budget this quarter',
      })
    ).not.toThrow();
  });

  it('rejects closing an already-closed request', () => {
    const request = baseRequest({ status: 'closed', reason: 'cancelled' });
    expect(() =>
      assertCanClose(request, { isAdmin: true, isAuthor: false, reason: 'fulfilled' })
    ).toThrow();
  });
});

describe('applyClose', () => {
  it('returns the close change set', () => {
    expect(
      applyClose(baseRequest(), { reason: 'fulfilled', closedBy: ADMIN, closedAt: CLOSED_AT })
    ).toEqual({
      status: 'closed',
      reason: 'fulfilled',
      closedBy: ADMIN,
      closedAt: CLOSED_AT,
    });
  });
});

describe('assertCanReopen', () => {
  it('allows the author to reopen a cancelled request', () => {
    const request = baseRequest({ status: 'closed', reason: 'cancelled' });
    expect(() => assertCanReopen(request, { isAdmin: false, isAuthor: true })).not.toThrow();
  });

  it('allows an admin to reopen a fulfilled request', () => {
    const request = baseRequest({ status: 'closed', reason: 'fulfilled' });
    expect(() => assertCanReopen(request, { isAdmin: true, isAuthor: false })).not.toThrow();
  });

  it('rejects reopening from a non-author, non-admin', () => {
    const request = baseRequest({ status: 'closed', reason: 'cancelled' });
    expect(() => assertCanReopen(request, { isAdmin: false, isAuthor: false })).toThrow();
  });

  it('rejects reopening a request that is already open', () => {
    expect(() => assertCanReopen(baseRequest(), { isAdmin: true, isAuthor: false })).toThrow();
  });
});

describe('applyReopen', () => {
  it('clears reason, closedBy and closedAt', () => {
    expect(applyReopen()).toEqual({
      status: 'open',
      reason: null,
      closedBy: null,
      closedAt: null,
    });
  });
});
