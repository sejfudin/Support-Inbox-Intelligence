// The pure half of the staged-picks cart — the shape the list, the seat groups
// and the submit body are all read out of. The hook itself is not covered here:
// there is no component-render setup in this project (see the root CLAUDE.md),
// so `sessionStorage` mirroring is verified by driving the app.
import { describe, it, expect } from 'vitest';
import { countStagedPicks, stagedInternIds, toPutForwardGroups } from './useStagedPicks';

const pick = (id, name = id) => ({ id, name, technologies: [], startDate: null });

const cart = {
  frontend: [pick('a'), pick('b')],
  qa: [pick('c')],
};

describe('countStagedPicks', () => {
  it('counts across every seat', () => {
    expect(countStagedPicks(cart)).toBe(3);
  });

  it('is zero for a missing or empty cart', () => {
    expect(countStagedPicks()).toBe(0);
    expect(countStagedPicks({ frontend: [] })).toBe(0);
  });
});

describe('stagedInternIds', () => {
  it('collects the ids from every seat', () => {
    expect(stagedInternIds(cart)).toEqual(new Set(['a', 'b', 'c']));
  });
});

describe('toPutForwardGroups', () => {
  it('sends one group per seat, ids only', () => {
    expect(toPutForwardGroups(cart)).toEqual([
      { positionId: 'frontend', internProfileIds: ['a', 'b'] },
      { positionId: 'qa', internProfileIds: ['c'] },
    ]);
  });

  // The server rejects an empty group as a shape error, and a seat the admin
  // emptied again is not part of the submit.
  it('drops seats with nothing staged', () => {
    expect(toPutForwardGroups({ frontend: [], qa: [pick('c')] })).toEqual([
      { positionId: 'qa', internProfileIds: ['c'] },
    ]);
  });
});
