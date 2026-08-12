import { describe, it, expect } from 'vitest';
import {
  getCloseOutSuggestions,
  getLeftoverSuggestions,
  getRequestBlocker,
  getNeededBy,
} from './requestPresentation';

// Only one blocker ever shows, so these assert precedence as much as content.

const TODAY = new Date('2026-08-11T12:00:00Z');

const openRequest = (overrides = {}) => ({
  status: 'open',
  project: { _id: 'p1', name: 'Atlas' },
  neededBy: '2026-12-01',
  progress: { positions: [{ position: 'fe', wanted: 2, putForward: 1, placed: 0 }] },
  suggestions: [{ position: 'fe', status: 'interviewing' }],
  ...overrides,
});

describe('getRequestBlocker on a closed request', () => {
  // Closing closes out everyone in selection for a position the request asked
  // for, so a leftover can only be someone tagged here for a position it no
  // longer lists — which the cascade leaves alone on purpose.
  it('names the interns left mid-pipeline on a position the request dropped', () => {
    const blocker = getRequestBlocker(
      openRequest({
        status: 'closed',
        reason: 'cancelled',
        suggestions: [
          { position: 'fe', status: 'interviewing' },
          { position: 'fe', status: 'recommended' },
        ],
      }),
      TODAY
    );

    expect(blocker).toMatchObject({ tone: 'warning' });
    expect(blocker.text).toContain('2 interns');
    expect(blocker.text).toMatch(/reassign/);
  });

  it('says one intern in the singular', () => {
    const blocker = getRequestBlocker(
      openRequest({ status: 'closed', suggestions: [{ status: 'recommended' }] }),
      TODAY
    );
    expect(blocker.text).toMatch(/^One intern/);
  });

  it('is silent when every suggestion was resolved before the close', () => {
    const blocker = getRequestBlocker(
      openRequest({
        status: 'closed',
        suggestions: [
          { status: 'resulted', outcome: 'placed' },
          { status: 'resulted', outcome: 'not_placed' },
        ],
      }),
      TODAY
    );
    expect(blocker).toBeNull();
  });

  it('is silent when nobody was ever put forward', () => {
    expect(getRequestBlocker(openRequest({ status: 'closed', suggestions: [] }), TODAY)).toBeNull();
  });

  // A closed request is not trying to fill seats any more, so none of the
  // open-request banners apply to it — including the overdue one.
  it('does not report an overdue date on a closed request', () => {
    const blocker = getRequestBlocker(
      openRequest({ status: 'closed', neededBy: '2026-01-01', suggestions: [] }),
      TODAY
    );
    expect(blocker).toBeNull();
  });
});

describe('getRequestBlocker on an open request', () => {
  it('reports a missing project ahead of everything else', () => {
    const blocker = getRequestBlocker(openRequest({ project: null }), TODAY);
    expect(blocker.text).toMatch(/does not exist yet/);
  });

  it('reports demand met once every seat is placed', () => {
    const blocker = getRequestBlocker(
      openRequest({
        progress: { positions: [{ position: 'fe', wanted: 2, putForward: 2, placed: 2 }] },
      }),
      TODAY
    );
    expect(blocker).toMatchObject({ tone: 'success' });
  });

  it('reports an overdue date while seats are unfilled', () => {
    const blocker = getRequestBlocker(openRequest({ neededBy: '2026-07-01' }), TODAY);
    expect(blocker.text).toMatch(/needed-by date passed/);
  });

  it('reports nobody put forward last of all', () => {
    const blocker = getRequestBlocker(
      openRequest({
        progress: { positions: [{ position: 'fe', wanted: 2, putForward: 0, placed: 0 }] },
        suggestions: [],
      }),
      TODAY
    );
    expect(blocker).toMatchObject({ tone: 'info' });
  });
});

describe('getLeftoverSuggestions', () => {
  it('counts only the open pipeline stages', () => {
    const leftover = getLeftoverSuggestions({
      suggestions: [
        { status: 'recommended' },
        { status: 'interviewing' },
        { status: 'resulted', outcome: 'placed' },
      ],
    });
    expect(leftover).toHaveLength(2);
  });

  it('is empty for a request nobody was suggested for', () => {
    expect(getLeftoverSuggestions({})).toEqual([]);
  });
});

// This is the number the close dialog promises and requires a reason off, so it
// has to agree with the server's `selectCloseOutRecommendations` exactly.
describe('getCloseOutSuggestions', () => {
  const request = (suggestions) => ({
    requestedPositions: [
      { position: { _id: 'fe' }, count: 1 },
      { position: 'qa', count: 1 },
    ],
    suggestions,
  });

  it('counts the in-selection candidates on the requested positions', () => {
    expect(
      getCloseOutSuggestions(
        request([
          { position: 'fe', status: 'recommended' },
          { position: 'qa', status: 'interviewing' },
        ])
      )
    ).toHaveLength(2);
  });

  it('leaves out anyone already resolved', () => {
    expect(
      getCloseOutSuggestions(
        request([
          { position: 'fe', status: 'resulted', outcome: 'placed' },
          { position: 'fe', status: 'resulted', outcome: 'not_placed' },
        ])
      )
    ).toEqual([]);
  });

  // The cascade doesn't touch these, so promising to close them out would make
  // the dialog lie — and would demand a reason the server never asked for.
  it('leaves out a candidate on a position the request no longer asks for', () => {
    expect(
      getCloseOutSuggestions(request([{ position: 'devops', status: 'interviewing' }]))
    ).toEqual([]);
  });

  it('matches a populated requested position against a raw suggestion id', () => {
    expect(
      getCloseOutSuggestions(request([{ position: 'fe', status: 'interviewing' }]))
    ).toHaveLength(1);
  });
});

describe('getNeededBy', () => {
  it('reports a missing date without inventing one', () => {
    expect(getNeededBy({ status: 'open' }, TODAY)).toMatchObject({
      missing: true,
      overdue: false,
    });
  });

  it('never calls a closed request overdue — its date is history', () => {
    expect(getNeededBy({ status: 'closed', neededBy: '2026-01-01' }, TODAY)).toMatchObject({
      overdue: false,
      sub: null,
    });
  });
});
