import { describe, expect, it } from 'vitest';
import {
  NAV_SECTION_KEYS,
  clampBadge,
  closedListFor,
  findActiveSectionKey,
  isValidClosedSections,
  parseClosedSections,
  resolveOpenSections,
  rollupSignals,
  serializeClosedSections,
} from './navSections';

// Stand-in sections, so these assertions do not have to be rewritten every time a
// nav row moves. Only the keys have to be real ones.
const SECTIONS = [
  { key: 'workspace', items: [{ to: '/dashboard' }, { to: '/analytics' }] },
  { key: 'boards', items: [{ to: '/tickets' }, { to: '/backlog', hidden: true }] },
  { key: 'admin', items: [{ to: '/admin/users' }] },
];

const exactly = (pathname) => (to) => to === pathname;

describe('parseClosedSections', () => {
  it('reads a comma-separated string', () => {
    expect(parseClosedSections('admin,boards')).toEqual(['admin', 'boards']);
  });

  it('trims whitespace', () => {
    expect(parseClosedSections(' admin , boards ')).toEqual(['admin', 'boards']);
  });

  it('drops a key we no longer ship', () => {
    expect(parseClosedSections('admin,retired-section')).toEqual(['admin']);
  });

  it('accepts an array as well as a string', () => {
    expect(parseClosedSections(['admin', 'nope'])).toEqual(['admin']);
  });

  it.each([null, undefined, 42, {}, true])('reads %s as nothing closed', (value) => {
    expect(parseClosedSections(value)).toEqual([]);
  });
});

describe('serializeClosedSections', () => {
  it('round-trips through parse', () => {
    expect(parseClosedSections(serializeClosedSections(['admin', 'boards']))).toEqual([
      'admin',
      'boards',
    ]);
  });

  it('refuses to write a key we do not ship', () => {
    expect(serializeClosedSections(['admin', 'made-up'])).toBe('admin');
  });

  it('writes nothing for an empty list', () => {
    expect(serializeClosedSections([])).toBe('');
  });

  it.each([null, undefined, 'admin'])('survives %s', (value) => {
    expect(serializeClosedSections(value)).toBe('');
  });
});

describe('isValidClosedSections', () => {
  it('accepts the empty string — nothing closed is a legal state', () => {
    expect(isValidClosedSections('')).toBe(true);
  });

  it('accepts a list of known keys', () => {
    expect(isValidClosedSections('admin,boards')).toBe(true);
  });

  it('rejects a list containing an unknown key, rather than half-applying it', () => {
    expect(isValidClosedSections('admin,retired-section')).toBe(false);
  });

  it.each([null, undefined, 7, [], {}])('rejects the non-string %s', (value) => {
    expect(isValidClosedSections(value)).toBe(false);
  });

  it('accepts every key we ship', () => {
    expect(isValidClosedSections(NAV_SECTION_KEYS.join(','))).toBe(true);
  });
});

describe('findActiveSectionKey', () => {
  it('finds the section holding the active route', () => {
    expect(findActiveSectionKey(SECTIONS, exactly('/tickets'))).toBe('boards');
  });

  it('returns null when no row matches', () => {
    expect(findActiveSectionKey(SECTIONS, exactly('/profile'))).toBeNull();
  });

  it('ignores a hidden row — a row the role cannot see cannot be the active one', () => {
    expect(findActiveSectionKey(SECTIONS, exactly('/backlog'))).toBeNull();
  });

  it.each([null, undefined, 'nope'])('survives %s as the section list', (value) => {
    expect(findActiveSectionKey(value, exactly('/tickets'))).toBeNull();
  });

  it('survives a missing matcher', () => {
    expect(findActiveSectionKey(SECTIONS, null)).toBeNull();
  });
});

describe('resolveOpenSections', () => {
  it('opens everything when nothing is closed', () => {
    expect([...resolveOpenSections(SECTIONS, '')]).toEqual(['workspace', 'boards', 'admin']);
  });

  it('closes what the stored list names', () => {
    expect([...resolveOpenSections(SECTIONS, 'admin')]).toEqual(['workspace', 'boards']);
  });

  it('ignores a closed key that is not a section here', () => {
    // A mentor's stored list can name `internship`; an admin renders no such
    // section, and that must not disturb the sections they do have.
    expect([...resolveOpenSections(SECTIONS, 'internship,admin')]).toEqual(['workspace', 'boards']);
  });

  it('opens a section the stored list does not mention — the migration case', () => {
    // Somebody closed Admin two releases ago; `boards` shipped yesterday. It has
    // to appear, not stay invisible forever.
    const withNewSection = [...SECTIONS, { key: 'mentoring', items: [{ to: '/my-interns' }] }];
    expect(resolveOpenSections(withNewSection, 'admin').has('mentoring')).toBe(true);
  });

  it('forces open the section holding the active route, even when it is closed', () => {
    const open = resolveOpenSections(SECTIONS, 'admin,boards', { forcedOpen: ['boards'] });
    expect(open.has('boards')).toBe(true);
    expect(open.has('admin')).toBe(false);
  });

  it('accepts a Set for forcedOpen as well as an array', () => {
    const open = resolveOpenSections(SECTIONS, 'admin', { forcedOpen: new Set(['admin']) });
    expect(open.has('admin')).toBe(true);
  });

  it('opens everything under allOpen, whatever is stored', () => {
    // The icon rail and a running tour. Both would otherwise hide rows with no
    // affordance to get them back.
    expect([...resolveOpenSections(SECTIONS, 'workspace,boards,admin', { allOpen: true })]).toEqual(
      ['workspace', 'boards', 'admin']
    );
  });

  it.each([null, undefined, 'garbage', 42, {}])(
    'falls back to all-open for the corrupt stored value %s',
    (value) => {
      expect(resolveOpenSections(SECTIONS, value).size).toBe(3);
    }
  );

  it('returns an empty set for no sections rather than throwing', () => {
    expect(resolveOpenSections(null, 'admin').size).toBe(0);
  });

  describe('singleOpen', () => {
    it('keeps only one section open when the stored list leaves several', () => {
      // The migration case under single-open: `boards` shipped after this list was
      // written, so it is "not closed" alongside `workspace`. Exactly one must win.
      const open = resolveOpenSections(SECTIONS, 'admin', { singleOpen: true });
      expect(open.size).toBe(1);
    });

    it('gives the tie to the section holding the active route', () => {
      const open = resolveOpenSections(SECTIONS, 'admin', {
        singleOpen: true,
        forcedOpen: ['boards'],
      });
      expect([...open]).toEqual(['boards']);
    });

    it('falls back to the first not-closed section when nothing is forced', () => {
      expect([...resolveOpenSections(SECTIONS, 'admin', { singleOpen: true })]).toEqual([
        'workspace',
      ]);
    });

    it('leaves a single already-open section alone', () => {
      expect([...resolveOpenSections(SECTIONS, 'workspace,admin', { singleOpen: true })]).toEqual([
        'boards',
      ]);
    });

    it('opens nothing when everything is closed', () => {
      expect(
        resolveOpenSections(SECTIONS, 'workspace,boards,admin', { singleOpen: true }).size
      ).toBe(0);
    });

    it('is overridden by allOpen — the rail and the tour still need every section', () => {
      const open = resolveOpenSections(SECTIONS, 'admin', { singleOpen: true, allOpen: true });
      expect(open.size).toBe(3);
    });
  });
});

describe('closedListFor', () => {
  it('closes every section but the named one', () => {
    expect(closedListFor(SECTIONS, 'boards')).toBe('workspace,admin');
  });

  it('closes everything when nothing is open', () => {
    expect(closedListFor(SECTIONS, null)).toBe('workspace,boards,admin');
  });

  it('round-trips through the resolver to exactly that one section', () => {
    const stored = closedListFor(SECTIONS, 'admin');
    expect([...resolveOpenSections(SECTIONS, stored, { singleOpen: true })]).toEqual(['admin']);
  });

  it('drops a key we do not ship rather than writing it', () => {
    const sections = [...SECTIONS, { key: 'not-a-section', items: [] }];
    expect(closedListFor(sections, 'boards')).toBe('workspace,admin');
  });

  it.each([null, undefined, 'nope'])('survives %s as the section list', (value) => {
    expect(closedListFor(value, 'boards')).toBe('');
  });
});

describe('rollupSignals', () => {
  it('reports nothing for rows carrying no signal', () => {
    expect(rollupSignals([{ label: 'Dashboard' }, { label: 'Tickets' }])).toEqual({
      dot: false,
      badge: undefined,
      badgeText: '',
      label: '',
    });
  });

  it('rolls a dot up and names it from dotLabel', () => {
    const result = rollupSignals([
      { label: 'Attendance' },
      { label: 'Absence Requests', dot: true, dotLabel: '2 time-away requests' },
    ]);
    expect(result.dot).toBe(true);
    expect(result.label).toBe('2 time-away requests');
  });

  it('falls back to the row label when a dot carries no dotLabel', () => {
    expect(rollupSignals([{ label: 'Absence Requests', dot: true }]).label).toBe(
      'Absence Requests'
    );
  });

  it('sums the badges of several rows', () => {
    const result = rollupSignals([
      { label: 'Invitations', badge: 2 },
      { label: 'Requests', badge: 3 },
    ]);
    expect(result.badge).toBe(5);
    expect(result.badgeText).toBe('5');
    expect(result.label).toBe('2 Invitations, 3 Requests');
  });

  it('clamps a summed badge past 99, the way NavItem does', () => {
    expect(
      rollupSignals([
        { label: 'A', badge: 60 },
        { label: 'B', badge: 60 },
      ]).badgeText
    ).toBe('99+');
  });

  it('names a dot before a count', () => {
    const result = rollupSignals([
      { label: 'Requests', badge: 4 },
      { label: 'Absence Requests', dot: true, dotLabel: '1 time-away request' },
    ]);
    expect(result.label).toBe('1 time-away request, 4 Requests');
  });

  it('ignores a hidden row — it is not on screen, so it has nothing to say', () => {
    expect(rollupSignals([{ label: 'Backlog', badge: 9, hidden: true }]).badge).toBeUndefined();
  });

  it('treats a zero or absent badge as no badge', () => {
    expect(rollupSignals([{ label: 'A', badge: 0 }, { label: 'B' }]).badge).toBeUndefined();
  });

  it.each([null, undefined, 'nope', 42])('survives %s', (value) => {
    expect(rollupSignals(value).dot).toBe(false);
  });
});

describe('clampBadge', () => {
  it.each([
    [1, '1'],
    [99, '99'],
    [100, '99+'],
  ])('renders %s as %s', (count, expected) => {
    expect(clampBadge(count)).toBe(expected);
  });
});
