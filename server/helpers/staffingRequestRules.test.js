const {
  deriveProgress,
  assertProjectEditable,
  needsProject,
  assertCanResolveProject,
  assertRequestedPositionsEditable,
  assertCanClose,
  applyClose,
  assertCanReopen,
  applyReopen,
  deriveUnreadStaffingRequestIds,
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

describe('needsProject', () => {
  it('is false once a real project is set', () => {
    expect(needsProject(baseRequest())).toBe(false);
  });

  it('is true for a request filed with only draft project details', () => {
    const request = baseRequest({ project: null, draftProject: { name: 'Kestrel' } });
    expect(needsProject(request)).toBe(true);
  });
});

describe('assertCanResolveProject', () => {
  it('allows resolving an open request that needs a project', () => {
    const request = baseRequest({ project: null, draftProject: { name: 'Kestrel' } });
    expect(() => assertCanResolveProject(request)).not.toThrow();
  });

  it('rejects resolving a request that already has a project', () => {
    expect(() => assertCanResolveProject(baseRequest())).toThrow();
  });

  it('rejects resolving a closed request', () => {
    const request = baseRequest({
      project: null,
      draftProject: { name: 'Kestrel' },
      status: 'closed',
      reason: 'cancelled',
    });
    expect(() => assertCanResolveProject(request)).toThrow();
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

  it('rejects closing as fulfilled while the request still needs a project', () => {
    const request = baseRequest({ project: null, draftProject: { name: 'Kestrel' } });
    expect(() =>
      assertCanClose(request, { isAdmin: true, isAuthor: false, reason: 'fulfilled' })
    ).toThrow();
  });

  it('allows cancelling a request that still needs a project', () => {
    const request = baseRequest({ project: null, draftProject: { name: 'Kestrel' } });
    expect(() =>
      assertCanClose(request, { isAdmin: false, isAuthor: true, reason: 'cancelled' })
    ).not.toThrow();
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

describe('deriveUnreadStaffingRequestIds', () => {
  const VIEWER = 'user-admin';
  const OTHER_USER = 'user-leadership';
  const REQUEST_A = 'request-a';
  const REQUEST_B = 'request-b';
  const LAST_SEEN = new Date('2026-02-01T00:00:00.000Z');

  const event = (overrides = {}) => ({
    entityId: REQUEST_A,
    userId: OTHER_USER,
    timestamp: new Date('2026-02-01T00:00:01.000Z'),
    ...overrides,
  });

  it('badges every request with news when the viewer has never opened the tab', () => {
    const unread = deriveUnreadStaffingRequestIds(
      [event({ entityId: REQUEST_A, timestamp: new Date('2020-01-01') })],
      { lastSeenAt: null, viewerId: VIEWER }
    );
    expect(unread).toEqual(new Set([REQUEST_A]));
  });

  it('excludes events the viewer themselves caused', () => {
    const unread = deriveUnreadStaffingRequestIds([event({ userId: VIEWER })], {
      lastSeenAt: LAST_SEEN,
      viewerId: VIEWER,
    });
    expect(unread).toEqual(new Set());
  });

  it('excludes an event exactly on the last-seen boundary', () => {
    const unread = deriveUnreadStaffingRequestIds([event({ timestamp: LAST_SEEN })], {
      lastSeenAt: LAST_SEEN,
      viewerId: VIEWER,
    });
    expect(unread).toEqual(new Set());
  });

  it('includes an event strictly newer than last-seen', () => {
    const unread = deriveUnreadStaffingRequestIds(
      [event({ timestamp: new Date(LAST_SEEN.getTime() + 1) })],
      { lastSeenAt: LAST_SEEN, viewerId: VIEWER }
    );
    expect(unread).toEqual(new Set([REQUEST_A]));
  });

  it('counts a request once despite multiple events', () => {
    const unread = deriveUnreadStaffingRequestIds(
      [
        event({ entityId: REQUEST_A, timestamp: new Date(LAST_SEEN.getTime() + 1) }),
        event({ entityId: REQUEST_A, timestamp: new Date(LAST_SEEN.getTime() + 2) }),
        event({ entityId: REQUEST_B, timestamp: new Date(LAST_SEEN.getTime() + 1) }),
      ],
      { lastSeenAt: LAST_SEEN, viewerId: VIEWER }
    );
    expect(unread).toEqual(new Set([REQUEST_A, REQUEST_B]));
  });
});
