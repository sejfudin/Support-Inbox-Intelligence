import { describe, it, expect } from 'vitest';
import {
  countRequestsByGroup,
  getPositionProgressRows,
  getRequestGroup,
  getStaffingRequestStatusLabel,
  hasNobodyPutForward,
  isAwaitingProject,
  isDemandMet,
} from './staffingRequests';

// These predicates replaced the server's `deriveDisplayState` / `isDemandMet`,
// which were unit-tested in staffingRequestRules.test.js before they moved.
// The cases carried over with them — `progress` here is what the API returns
// (deriveProgress's output), never recomputed.

const request = ({ positions = [], ...rest } = {}) => ({
  status: 'open',
  project: { _id: 'p1', name: 'Atlas' },
  progress: {
    positions,
    totals: positions.reduce(
      (totals, position) => ({
        wanted: totals.wanted + position.wanted,
        putForward: totals.putForward + position.putForward,
        inSelection: totals.inSelection + position.inSelection,
        placed: totals.placed + position.placed,
      }),
      { wanted: 0, putForward: 0, inSelection: 0, placed: 0 }
    ),
  },
  ...rest,
});

// `inSelection` defaults to whatever is put forward and not yet placed, which
// is the shape most of these cases want; the ones about resolved candidates
// pass it explicitly.
const progressRow = (position, wanted, putForward, placed, inSelection) => ({
  position,
  wanted,
  putForward,
  inSelection: inSelection ?? Math.max(0, putForward - placed),
  placed,
});

describe('isDemandMet', () => {
  it('is false when one position is short', () => {
    expect(
      isDemandMet(request({ positions: [progressRow('fe', 2, 2, 2), progressRow('qa', 1, 0, 0)] }))
    ).toBe(false);
  });

  it('is true when every position is met', () => {
    expect(
      isDemandMet(request({ positions: [progressRow('fe', 1, 1, 1), progressRow('qa', 1, 1, 1)] }))
    ).toBe(true);
  });

  // The case the count-lowering rule creates: a position may hold more placed
  // interns than it now wants, and that still counts as met.
  it('is true when met only because a count was lowered', () => {
    expect(isDemandMet(request({ positions: [progressRow('fe', 1, 2, 2)] }))).toBe(true);
  });

  it('is false for a request with no requested positions at all', () => {
    expect(isDemandMet(request({ positions: [] }))).toBe(false);
  });

  it('is false when nobody has been placed yet', () => {
    expect(isDemandMet(request({ positions: [progressRow('fe', 1, 3, 0)] }))).toBe(false);
  });
});

describe('hasNobodyPutForward', () => {
  it('is true before anyone is suggested', () => {
    expect(hasNobodyPutForward(request({ positions: [progressRow('fe', 2, 0, 0)] }))).toBe(true);
  });

  it('is false once someone is put forward, placed or not', () => {
    expect(hasNobodyPutForward(request({ positions: [progressRow('fe', 2, 1, 0)] }))).toBe(false);
  });
});

describe('isAwaitingProject', () => {
  it('is true for a request filed against a draft project', () => {
    expect(isAwaitingProject(request({ project: null }))).toBe(true);
  });

  it('is false once a real project is attached', () => {
    expect(isAwaitingProject(request())).toBe(false);
  });
});

describe('getStaffingRequestStatusLabel', () => {
  it('reads Open while the request is open', () => {
    expect(getStaffingRequestStatusLabel(request())).toBe('Open');
  });

  it('names the close reason, so fulfilled never reads like declined', () => {
    expect(getStaffingRequestStatusLabel({ status: 'closed', reason: 'fulfilled' })).toBe(
      'Fulfilled'
    );
    expect(getStaffingRequestStatusLabel({ status: 'closed', reason: 'declined' })).toBe(
      'Declined'
    );
    expect(getStaffingRequestStatusLabel({ status: 'closed', reason: 'cancelled' })).toBe(
      'Cancelled'
    );
  });

  it('falls back to Closed for an unknown reason rather than showing nothing', () => {
    expect(getStaffingRequestStatusLabel({ status: 'closed' })).toBe('Closed');
  });
});

describe('countRequestsByGroup', () => {
  it('partitions the list, so the group counts sum to all', () => {
    const counts = countRequestsByGroup([
      { status: 'open' },
      { status: 'open' },
      { status: 'closed', reason: 'cancelled' },
    ]);
    expect(counts).toEqual({ all: 3, open: 2, closed: 1 });
    expect(counts.open + counts.closed).toBe(counts.all);
  });

  it('groups anything that is not closed as open', () => {
    expect(getRequestGroup({ status: undefined })).toBe('open');
  });
});

describe('getPositionProgressRows', () => {
  const requestedPosition = (id, name, count) => ({
    position: { _id: id, name },
    count,
  });

  it('keeps a requested position nobody was suggested for — the gap is the information', () => {
    const rows = getPositionProgressRows({
      requestedPositions: [
        requestedPosition('fe', 'Frontend', 2),
        requestedPosition('qa', 'QA', 1),
      ],
      progress: { positions: [progressRow('fe', 2, 1, 0)] },
      suggestions: [{ position: 'fe' }],
    });

    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({
      name: 'QA',
      wanted: 1,
      putForward: 0,
      inSelection: 0,
      placed: 0,
    });
    expect(rows[1].suggestions).toEqual([]);
  });

  // The number that says whether anyone is still live, carried per position so
  // a group can never collapse "six offered" into "six waiting".
  it('carries in-selection through from the progress row', () => {
    const rows = getPositionProgressRows({
      requestedPositions: [requestedPosition('fe', 'Frontend', 3)],
      progress: { positions: [progressRow('fe', 3, 6, 2, 0)] },
      suggestions: [],
    });

    expect(rows[0]).toMatchObject({ wanted: 3, putForward: 6, inSelection: 0, placed: 2 });
  });

  it('pairs suggestions to their position by id', () => {
    const rows = getPositionProgressRows({
      requestedPositions: [requestedPosition('fe', 'Frontend', 1)],
      progress: { positions: [progressRow('fe', 1, 2, 1)] },
      suggestions: [{ position: 'fe' }, { position: 'qa' }],
    });

    expect(rows[0].suggestions).toEqual([{ position: 'fe' }]);
  });
});
