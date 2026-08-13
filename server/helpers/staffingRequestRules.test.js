const {
  StaffingRequestForbiddenError,
  StagedPickRejectionError,
  deriveProgress,
  partitionPickerCandidates,
  needsProject,
  assertCanResolveProject,
  planStaffingRequestEdit,
  assertCanPutForward,
  assertCanClose,
  applyClose,
  selectCloseOutRecommendations,
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

// A recommendation is `resulted` exactly when an outcome has been written, so
// the default status follows the outcome unless a test overrides it.
const recommendation = ({ position = FRONTEND, outcome, status, internName } = {}) => ({
  position,
  status: status ?? (outcome ? 'resulted' : 'interviewing'),
  result: outcome ? { outcome } : {},
  ...(internName ? { internProfile: { user: { fullname: internName } } } : {}),
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
      positions: [{ position: FRONTEND, wanted: 2, putForward: 0, inSelection: 0, placed: 0 }],
      totals: { wanted: 2, putForward: 0, inSelection: 0, placed: 0 },
    });
  });

  it('counts over-supply beyond the wanted count', () => {
    const recs = Array.from({ length: 6 }, () => recommendation({ outcome: 'placed' }));
    const progress = deriveProgress([requestedPosition({ count: 3 })], recs);
    expect(progress).toEqual({
      positions: [{ position: FRONTEND, wanted: 3, putForward: 6, inSelection: 0, placed: 6 }],
      totals: { wanted: 3, putForward: 6, inSelection: 0, placed: 6 },
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
      inSelection: 1,
      placed: 1,
    });
  });

  // The case the third number exists for: everyone offered has been resolved,
  // so `putForward` still reports a full pipeline while nobody is live.
  it('reports every candidate resolved as put forward without anyone in selection', () => {
    const recs = [
      ...Array.from({ length: 2 }, () => recommendation({ outcome: 'placed' })),
      ...Array.from({ length: 4 }, () => recommendation({ outcome: 'not_placed' })),
    ];
    const progress = deriveProgress([requestedPosition({ count: 3 })], recs);
    expect(progress.positions[0]).toEqual({
      position: FRONTEND,
      wanted: 3,
      putForward: 6,
      inSelection: 0,
      placed: 2,
    });
  });

  it('counts a recommended candidate as in selection alongside an interviewing one', () => {
    const recs = [
      recommendation({ status: 'recommended' }),
      recommendation({ status: 'interviewing' }),
    ];
    const progress = deriveProgress([requestedPosition({ count: 2 })], recs);
    expect(progress.positions[0].inSelection).toBe(2);
  });

  it('ignores a recommendation whose position is not in the request', () => {
    const recs = [recommendation({ position: OTHER, outcome: 'placed' })];
    const progress = deriveProgress([requestedPosition({ count: 2 })], recs);
    expect(progress).toEqual({
      positions: [{ position: FRONTEND, wanted: 2, putForward: 0, inSelection: 0, placed: 0 }],
      totals: { wanted: 2, putForward: 0, inSelection: 0, placed: 0 },
    });
  });

  it('reflects a count lowered below the already-placed number', () => {
    const recs = [recommendation({ outcome: 'placed' }), recommendation({ outcome: 'placed' })];
    const progress = deriveProgress([requestedPosition({ count: 1 })], recs);
    expect(progress.positions[0]).toEqual({
      position: FRONTEND,
      wanted: 1,
      putForward: 2,
      inSelection: 0,
      placed: 2,
    });
  });

  it('derives totals across multiple requested positions', () => {
    const recs = [
      recommendation({ position: FRONTEND, outcome: 'placed' }),
      recommendation({ position: QA, outcome: 'not_placed' }),
      recommendation({ position: QA, status: 'recommended' }),
    ];
    const progress = deriveProgress(
      [
        requestedPosition({ position: FRONTEND, count: 1 }),
        requestedPosition({ position: QA, count: 1 }),
      ],
      recs
    );
    expect(progress.totals).toEqual({ wanted: 2, putForward: 3, inSelection: 1, placed: 1 });
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
    expect(progress.totals).toEqual({ wanted: 2, putForward: 2, inSelection: 1, placed: 1 });
  });

  it('reports the position as an id even when it arrived populated', () => {
    const progress = deriveProgress(
      [{ position: { _id: FRONTEND, name: 'Frontend Engineer' }, count: 1, technologies: [] }],
      []
    );
    expect(progress.positions[0].position).toBe(FRONTEND);
  });
});

describe('partitionPickerCandidates', () => {
  const BOREALIS = { _id: 'project-borealis', name: 'Borealis' };
  const KESTREL = { _id: PROJECT, name: 'Kestrel' };

  const candidate = (overrides = {}) => ({
    internProfile: 'profile-1',
    status: 'ready',
    recommendations: [],
    ...overrides,
  });

  const onProject = (project, overrides = {}) => ({
    project,
    status: 'interviewing',
    result: {},
    ...overrides,
  });

  it('keeps an available intern with no recommendations clean', () => {
    const { excluded, warned, clean } = partitionPickerCandidates([candidate()]);
    expect(excluded).toEqual([]);
    expect(warned).toEqual([]);
    expect(clean).toEqual([{ internProfile: 'profile-1', eligibility: 'clean', flags: [] }]);
  });

  it('excludes a discontinued intern — offering them is always a mistake', () => {
    const { excluded, clean } = partitionPickerCandidates([candidate({ status: 'discontinued' })]);
    expect(clean).toEqual([]);
    expect(excluded).toEqual([
      { internProfile: 'profile-1', eligibility: 'excluded', flags: [{ type: 'discontinued' }] },
    ]);
  });

  it('excludes an intern who has completed the programme', () => {
    const { excluded } = partitionPickerCandidates([candidate({ status: 'completed' })]);
    expect(excluded[0].flags).toEqual([{ type: 'completed' }]);
  });

  it('excludes an intern already put forward against this requested position', () => {
    const { excluded } = partitionPickerCandidates([candidate()], {
      alreadyPutForwardProfileIds: ['profile-1'],
    });
    expect(excluded[0].flags).toEqual([{ type: 'already-put-forward' }]);
  });

  it('warns rather than blocks an intern who is already placed, naming where', () => {
    const { warned, clean } = partitionPickerCandidates([
      candidate({
        status: 'placed',
        recommendations: [
          onProject(BOREALIS, { status: 'resulted', result: { outcome: 'placed' } }),
        ],
      }),
    ]);
    expect(clean).toEqual([]);
    expect(warned).toEqual([
      {
        internProfile: 'profile-1',
        eligibility: 'warned',
        flags: [{ type: 'placed', projects: ['Borealis'] }],
      },
    ]);
  });

  it('warns about an intern in selection elsewhere, naming where', () => {
    const { warned } = partitionPickerCandidates([
      candidate({ recommendations: [onProject(BOREALIS)] }),
    ]);
    expect(warned[0].flags).toEqual([{ type: 'in-selection', projects: ['Borealis'] }]);
  });

  // The picker is scoped to one project, so being in selection for that same
  // project is the request's own pipeline, not a double-booking.
  it('does not warn about being in selection for the project being staffed', () => {
    const { clean } = partitionPickerCandidates(
      [candidate({ recommendations: [onProject(KESTREL)] })],
      { projectId: PROJECT }
    );
    expect(clean).toHaveLength(1);
  });

  it('names every project an intern is in selection for, without duplicates', () => {
    const { warned } = partitionPickerCandidates([
      candidate({
        recommendations: [onProject(BOREALIS), onProject(BOREALIS), onProject(KESTREL)],
      }),
    ]);
    expect(warned[0].flags).toEqual([{ type: 'in-selection', projects: ['Borealis', 'Kestrel'] }]);
  });

  it('carries both flags for an intern who is placed and in selection elsewhere', () => {
    const { warned } = partitionPickerCandidates([
      candidate({
        status: 'placed',
        recommendations: [
          onProject(KESTREL, { status: 'resulted', result: { outcome: 'placed' } }),
          onProject(BOREALIS),
        ],
      }),
    ]);
    expect(warned[0].flags).toEqual([
      { type: 'placed', projects: ['Kestrel'] },
      { type: 'in-selection', projects: ['Borealis'] },
    ]);
  });

  // Exclusion wins outright: a discontinued intern is never shown, whatever
  // else is true of them.
  it('excludes rather than warns when both apply', () => {
    const { excluded, warned } = partitionPickerCandidates([
      candidate({ status: 'discontinued', recommendations: [onProject(BOREALIS)] }),
    ]);
    expect(warned).toEqual([]);
    expect(excluded[0].flags).toEqual([{ type: 'discontinued' }]);
  });

  // Otherwise most of the programme carries a warning: an intern who finished
  // a project months ago still has a placed recommendation on record.
  it('does not flag a past placement when the intern is no longer placed', () => {
    const { clean } = partitionPickerCandidates([
      candidate({
        status: 'ready',
        recommendations: [
          onProject(BOREALIS, { status: 'resulted', result: { outcome: 'placed' } }),
        ],
      }),
    ]);
    expect(clean).toHaveLength(1);
  });

  it('ignores a resolved not-placed recommendation — that process is over', () => {
    const { clean } = partitionPickerCandidates([
      candidate({
        recommendations: [
          onProject(BOREALIS, { status: 'resulted', result: { outcome: 'not_placed' } }),
        ],
      }),
    ]);
    expect(clean).toHaveLength(1);
  });
});

// The two refusals this module makes have to stay distinguishable without
// reading message text — that is the whole reason the "not you" one is a typed
// error carrying its own status.
describe('refusal types', () => {
  it('tags a "not you" refusal with 403', () => {
    expect(() => assertCanPutForward(baseRequest(), { isAdmin: false })).toThrow(
      StaffingRequestForbiddenError
    );
    try {
      assertCanPutForward(baseRequest(), { isAdmin: false });
    } catch (error) {
      expect(error.statusCode).toBe(403);
    }
  });

  it('leaves an illegal move as a plain Error with no status, so callers fall to 400', () => {
    const closed = baseRequest({ status: 'closed', reason: 'cancelled' });
    try {
      assertCanPutForward(closed, { isAdmin: true });
      throw new Error('expected a refusal');
    } catch (error) {
      expect(error).not.toBeInstanceOf(StaffingRequestForbiddenError);
      expect(error.statusCode).toBeUndefined();
    }
  });

  it('carries the per-pick reasons on a staged-pick refusal', () => {
    const rejections = [{ internProfileId: 'profile-1', reason: 'Already put forward' }];
    const error = new StagedPickRejectionError(rejections);

    expect(error.statusCode).toBe(409);
    expect(error.data).toEqual({ rejections });
  });
});

describe('assertCanPutForward', () => {
  it('allows an admin to put interns forward against an open, resolved request', () => {
    expect(() => assertCanPutForward(baseRequest(), { isAdmin: true })).not.toThrow();
  });

  it('rejects a non-admin', () => {
    expect(() => assertCanPutForward(baseRequest(), { isAdmin: false })).toThrow();
  });

  it('rejects a closed request', () => {
    const request = baseRequest({ status: 'closed', reason: 'cancelled' });
    expect(() => assertCanPutForward(request, { isAdmin: true })).toThrow();
  });

  // Recommendation.project is a required reference — there is nothing to create
  // a recommendation against until the draft project is resolved.
  it('rejects a request whose draft project is unresolved', () => {
    const request = baseRequest({ project: null, draftProject: { name: 'Kestrel' } });
    expect(() => assertCanPutForward(request, { isAdmin: true })).toThrow();
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

// The edit rules of ticket 10. The old lock — "any recommendation freezes this
// position" — is gone: being considered is not a reason to refuse, being placed
// is. Everything else the edit may do, it reports the consequence of.
describe('planStaffingRequestEdit', () => {
  // The current ask, with positions populated the way REQUEST_POPULATE leaves
  // them, so a refusal can name the position rather than print an id.
  const openRequest = (overrides = {}) =>
    baseRequest({
      requestedPositions: [
        { position: { _id: FRONTEND, name: 'Frontend' }, count: 2, technologies: [] },
        { position: { _id: QA, name: 'QA' }, count: 1, technologies: [] },
      ],
      ...overrides,
    });

  it('reports no consequence when nothing about the ask changes', () => {
    expect(
      planStaffingRequestEdit(
        openRequest(),
        {
          requestedPositions: [
            requestedPosition({ position: FRONTEND }),
            requestedPosition({ position: QA, count: 1 }),
          ],
        },
        [recommendation({ position: FRONTEND })]
      )
    ).toEqual({
      endingPositionIds: [],
      closeOutCount: 0,
      projectChanged: false,
      movingCount: 0,
    });
  });

  it('permits removing a position whose candidates are only in selection, reporting how many close out', () => {
    expect(
      planStaffingRequestEdit(
        openRequest(),
        { requestedPositions: [requestedPosition({ position: QA, count: 1 })] },
        [
          recommendation({ position: FRONTEND }),
          recommendation({ position: FRONTEND, status: 'recommended' }),
          recommendation({ position: QA }),
        ]
      )
    ).toMatchObject({ endingPositionIds: [FRONTEND], closeOutCount: 2 });
  });

  it('treats changing a position as ending the old one — there is no row identity to follow', () => {
    expect(
      planStaffingRequestEdit(
        openRequest(),
        {
          requestedPositions: [
            requestedPosition({ position: OTHER }),
            requestedPosition({ position: QA, count: 1 }),
          ],
        },
        [recommendation({ position: FRONTEND })]
      )
    ).toMatchObject({ endingPositionIds: [FRONTEND], closeOutCount: 1 });
  });

  it('counts nobody already resulted among the candidates an ending position closes out', () => {
    expect(
      planStaffingRequestEdit(
        openRequest(),
        { requestedPositions: [requestedPosition({ position: QA, count: 1 })] },
        [recommendation({ position: FRONTEND, outcome: 'not_placed' })]
      )
    ).toMatchObject({ closeOutCount: 0 });
  });

  it('refuses to end a position someone is placed against, naming the intern', () => {
    expect(() =>
      planStaffingRequestEdit(
        openRequest(),
        { requestedPositions: [requestedPosition({ position: QA, count: 1 })] },
        [recommendation({ position: FRONTEND, outcome: 'placed', internName: 'Ana' })]
      )
    ).toThrow("Frontend can't be changed, Ana is already placed against it");
  });

  it('names every placed intern when a position has more than one', () => {
    expect(() =>
      planStaffingRequestEdit(
        openRequest(),
        { requestedPositions: [requestedPosition({ position: QA, count: 1 })] },
        [
          recommendation({ position: FRONTEND, outcome: 'placed', internName: 'Ana' }),
          recommendation({ position: FRONTEND, outcome: 'placed', internName: 'Ben' }),
        ]
      )
    ).toThrow("Frontend can't be changed, Ana and Ben are already placed against it");
  });

  it('keeps a position with a placed intern editable as long as it is still asked for', () => {
    expect(() =>
      planStaffingRequestEdit(
        openRequest(),
        {
          requestedPositions: [
            requestedPosition({ position: FRONTEND, count: 1 }),
            requestedPosition({ position: QA, count: 1 }),
          ],
        },
        [recommendation({ position: FRONTEND, outcome: 'placed', internName: 'Ana' })]
      )
    ).not.toThrow();
  });

  it('lowers a count below what is already placed without closing anyone out', () => {
    expect(
      planStaffingRequestEdit(
        openRequest(),
        {
          requestedPositions: [
            requestedPosition({ position: FRONTEND, count: 1 }),
            requestedPosition({ position: QA, count: 1 }),
          ],
        },
        [
          recommendation({ position: FRONTEND, outcome: 'placed', internName: 'Ana' }),
          recommendation({ position: FRONTEND, outcome: 'placed', internName: 'Ben' }),
        ]
      )
    ).toMatchObject({ endingPositionIds: [], closeOutCount: 0 });
  });

  it('rejects a count below 1', () => {
    expect(() =>
      planStaffingRequestEdit(openRequest(), {
        requestedPositions: [requestedPosition({ count: 0 })],
      })
    ).toThrow('Count must be an integer of at least 1');
  });

  it('rejects a duplicate position', () => {
    expect(() =>
      planStaffingRequestEdit(openRequest(), {
        requestedPositions: [
          requestedPosition({ position: FRONTEND }),
          requestedPosition({ position: FRONTEND }),
        ],
      })
    ).toThrow(`Duplicate position: ${FRONTEND}`);
  });

  it('reports how many recommendations a project move takes with it, placed ones included', () => {
    expect(
      planStaffingRequestEdit(openRequest(), { projectId: 'project-borealis' }, [
        recommendation({ position: FRONTEND }),
        recommendation({ position: FRONTEND, outcome: 'placed', internName: 'Ana' }),
      ])
    ).toMatchObject({ projectChanged: true, movingCount: 2 });
  });

  it('never refuses a project move, not even with someone placed', () => {
    expect(() =>
      planStaffingRequestEdit(openRequest(), { projectId: 'project-borealis' }, [
        recommendation({ position: FRONTEND, outcome: 'placed', internName: 'Ana' }),
      ])
    ).not.toThrow();
  });

  it('reports no move when the project given is the one already set', () => {
    expect(
      planStaffingRequestEdit(openRequest(), { projectId: PROJECT }, [recommendation()])
    ).toMatchObject({ projectChanged: false, movingCount: 0 });
  });

  it('refuses to set the first project through the edit path — that is resolution', () => {
    expect(() =>
      planStaffingRequestEdit(openRequest({ project: null, draftProject: { name: 'Borealis' } }), {
        projectId: 'project-borealis',
      })
    ).toThrow('Resolve the project before moving it');
  });

  it('rejects every edit on a closed request', () => {
    expect(() =>
      planStaffingRequestEdit(openRequest({ status: 'closed', reason: 'cancelled' }), {
        requestedPositions: [requestedPosition({ position: FRONTEND })],
      })
    ).toThrow('Cannot edit a closed staffing request');
  });

  it('rejects a note-only edit on a closed request too — notes have their own path', () => {
    expect(() =>
      planStaffingRequestEdit(openRequest({ status: 'closed', reason: 'fulfilled' }), {})
    ).toThrow('Cannot edit a closed staffing request');
  });
});

// Leadership withdraws, admin answers — one sentence, and every case below is
// a reading of it.
describe('assertCanClose', () => {
  it('allows any leadership user to cancel, author or not', () => {
    expect(() =>
      assertCanClose(baseRequest(), {
        isAdmin: false,
        isLeadership: true,
        reason: 'cancelled',
        note: 'Client pulled out',
      })
    ).not.toThrow();
  });

  it('rejects an admin cancelling — only leadership speaks for the demand', () => {
    expect(() =>
      assertCanClose(baseRequest(), { isAdmin: true, isLeadership: false, reason: 'cancelled' })
    ).toThrow(/leadership/i);
  });

  it('rejects cancel from neither admin nor leadership', () => {
    expect(() =>
      assertCanClose(baseRequest(), { isAdmin: false, isLeadership: false, reason: 'cancelled' })
    ).toThrow();
  });

  it('rejects leadership closing as fulfilled', () => {
    expect(() =>
      assertCanClose(baseRequest(), { isAdmin: false, isLeadership: true, reason: 'fulfilled' })
    ).toThrow(/admin/i);
  });

  it('rejects leadership declining', () => {
    expect(() =>
      assertCanClose(baseRequest(), {
        isAdmin: false,
        isLeadership: true,
        reason: 'declined',
        note: 'No capacity',
      })
    ).toThrow(/admin/i);
  });

  it('allows an admin to close as fulfilled', () => {
    expect(() =>
      assertCanClose(baseRequest(), { isAdmin: true, isLeadership: false, reason: 'fulfilled' })
    ).not.toThrow();
  });

  it('rejects declined with no note', () => {
    expect(() =>
      assertCanClose(baseRequest(), {
        isAdmin: true,
        isLeadership: false,
        reason: 'declined',
        note: '  ',
      })
    ).toThrow();
  });

  it('allows declined with a non-empty note', () => {
    expect(() =>
      assertCanClose(baseRequest(), {
        isAdmin: true,
        isLeadership: false,
        reason: 'declined',
        note: 'No budget this quarter',
      })
    ).not.toThrow();
  });

  // Cancelling leaves the ask unmet the same way declining does, and nothing on
  // a closed request can be revised afterwards — so it states why, or it fails.
  it('rejects cancelled with no note', () => {
    expect(() =>
      assertCanClose(baseRequest(), {
        isAdmin: false,
        isLeadership: true,
        reason: 'cancelled',
        note: '  ',
      })
    ).toThrow(/reason/i);
  });

  it('needs no note to close as fulfilled — the placements are the explanation', () => {
    expect(() =>
      assertCanClose(baseRequest(), { isAdmin: true, isLeadership: false, reason: 'fulfilled' })
    ).not.toThrow();
  });

  it('rejects closing an already-closed request', () => {
    const request = baseRequest({ status: 'closed', reason: 'cancelled' });
    expect(() =>
      assertCanClose(request, { isAdmin: true, isLeadership: false, reason: 'fulfilled' })
    ).toThrow();
  });

  it('rejects an unknown reason', () => {
    expect(() =>
      assertCanClose(baseRequest(), { isAdmin: true, isLeadership: false, reason: 'abandoned' })
    ).toThrow(/reason/i);
  });

  it('rejects closing as fulfilled while the request still needs a project', () => {
    const request = baseRequest({ project: null, draftProject: { name: 'Kestrel' } });
    expect(() =>
      assertCanClose(request, { isAdmin: true, isLeadership: false, reason: 'fulfilled' })
    ).toThrow();
  });

  it('allows cancelling a request that still needs a project', () => {
    const request = baseRequest({ project: null, draftProject: { name: 'Kestrel' } });
    expect(() =>
      assertCanClose(request, {
        isAdmin: false,
        isLeadership: true,
        reason: 'cancelled',
        note: 'Never signed',
      })
    ).not.toThrow();
  });

  // The not-placed reason is required exactly when the close will write it onto
  // someone's record, and not one case earlier.
  it('requires a not-placed reason when candidates are in selection', () => {
    expect(() =>
      assertCanClose(baseRequest(), {
        isAdmin: false,
        isLeadership: true,
        reason: 'cancelled',
        note: 'Client pulled out',
        inSelectionCount: 3,
      })
    ).toThrow(/reason/i);
  });

  it('rejects a blank not-placed reason when candidates are in selection', () => {
    expect(() =>
      assertCanClose(baseRequest(), {
        isAdmin: true,
        isLeadership: false,
        reason: 'fulfilled',
        notPlacedReason: '   ',
        inSelectionCount: 1,
      })
    ).toThrow(/reason/i);
  });

  it('allows a close with a not-placed reason when candidates are in selection', () => {
    expect(() =>
      assertCanClose(baseRequest(), {
        isAdmin: true,
        isLeadership: false,
        reason: 'fulfilled',
        notPlacedReason: 'The seats went to two other candidates',
        inSelectionCount: 2,
      })
    ).not.toThrow();
  });

  it('needs no not-placed reason when nobody is in selection', () => {
    expect(() =>
      assertCanClose(baseRequest(), {
        isAdmin: true,
        isLeadership: false,
        reason: 'fulfilled',
        inSelectionCount: 0,
      })
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

describe('selectCloseOutRecommendations', () => {
  it('selects the candidates still in selection', () => {
    const selected = selectCloseOutRecommendations(
      [
        recommendation({ status: 'recommended' }),
        recommendation({ status: 'interviewing' }),
        recommendation({ position: QA, status: 'recommended' }),
      ],
      [FRONTEND, QA]
    );
    expect(selected).toHaveLength(3);
  });

  it('leaves placed interns alone', () => {
    const selected = selectCloseOutRecommendations(
      [recommendation({ outcome: 'placed' })],
      [FRONTEND]
    );
    expect(selected).toEqual([]);
  });

  it('leaves candidates already resolved as not placed alone', () => {
    const selected = selectCloseOutRecommendations(
      [recommendation({ outcome: 'not_placed' })],
      [FRONTEND]
    );
    expect(selected).toEqual([]);
  });

  it('takes only the in-selection ones out of a mixed set', () => {
    const live = recommendation({ status: 'interviewing' });
    const selected = selectCloseOutRecommendations(
      [recommendation({ outcome: 'placed' }), live, recommendation({ outcome: 'not_placed' })],
      [FRONTEND]
    );
    expect(selected).toEqual([live]);
  });

  it('selects nobody when nobody is in selection', () => {
    expect(selectCloseOutRecommendations([], [FRONTEND])).toEqual([]);
  });

  // The same recommendation this ignores is the one deriveProgress ignores: it
  // is not attributable to any position the close is ending.
  it('ignores a tagged recommendation whose position is not among the ones ending', () => {
    const selected = selectCloseOutRecommendations(
      [recommendation({ position: OTHER, status: 'interviewing' })],
      [FRONTEND, QA]
    );
    expect(selected).toEqual([]);
  });

  // Ticket 10's edit path ends one position at a time, so the selector has to
  // narrow to the positions it is given rather than to the whole request.
  it('narrows to the positions it is given', () => {
    const frontend = recommendation({ status: 'recommended' });
    const selected = selectCloseOutRecommendations(
      [frontend, recommendation({ position: QA, status: 'recommended' })],
      [FRONTEND]
    );
    expect(selected).toEqual([frontend]);
  });

  it('matches a populated position document against a requested position id', () => {
    const selected = selectCloseOutRecommendations(
      [{ position: { _id: FRONTEND, name: 'Frontend Engineer' }, status: 'interviewing' }],
      [FRONTEND]
    );
    expect(selected).toHaveLength(1);
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
