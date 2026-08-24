import { describe, expect, it } from 'vitest';
import {
  QUICK_ACTIONS_DEFAULT_COUNT,
  QUICK_ACTIONS_MAX,
  QUICK_ACTIONS_NONE,
  QUICK_ACTION_CATALOG,
  availableQuickActions,
  decodeQuickActionSelection,
  encodeQuickActionSelection,
  isValidQuickActionOrder,
  quickActionsForRole,
  resolveQuickActions,
} from './quickActions';
import { ROLES } from './roles';

// A stand-in catalog, so these assertions do not have to be rewritten every time
// a real action is added. The shipped catalog gets its own block further down.
// Six admin rows on purpose — one more than the cap.
const CATALOG = [
  { key: 'first', label: 'First', roles: [ROLES.ADMIN] },
  { key: 'second', label: 'Second', roles: [ROLES.ADMIN, ROLES.MENTOR] },
  { key: 'third', label: 'Third', roles: [ROLES.ADMIN] },
  { key: 'fourth', label: 'Fourth', roles: [ROLES.ADMIN] },
  { key: 'fifth', label: 'Fifth', roles: [ROLES.ADMIN] },
  { key: 'sixth', label: 'Sixth', roles: [ROLES.ADMIN] },
  { key: 'mentor-only', label: 'Mentor only', roles: [ROLES.MENTOR] },
];

const keysOf = (actions) => actions.map((action) => action.key);

describe('decodeQuickActionSelection', () => {
  // The three states have to stay distinct: "never chosen" shows the shipped
  // default, "chose none" shows nothing. Flattening them means removing the last
  // action snaps five defaults back and reads as a bug.
  it('reads an empty or missing cache as "never chosen"', () => {
    expect(decodeQuickActionSelection('')).toBeNull();
    expect(decodeQuickActionSelection(null)).toBeNull();
    expect(decodeQuickActionSelection(undefined)).toBeNull();
  });

  it('reads the sentinel as a deliberate empty selection', () => {
    expect(decodeQuickActionSelection(QUICK_ACTIONS_NONE)).toEqual([]);
  });

  it('reads a list, and survives the whitespace a hand-edited cache would carry', () => {
    expect(decodeQuickActionSelection('add-intern, assign-ticket,')).toEqual([
      'add-intern',
      'assign-ticket',
    ]);
  });

  it('round-trips through the encoder, empty selection included', () => {
    expect(decodeQuickActionSelection(encodeQuickActionSelection(['third', 'first']))).toEqual([
      'third',
      'first',
    ]);
    expect(encodeQuickActionSelection([])).toBe(QUICK_ACTIONS_NONE);
    expect(decodeQuickActionSelection(encodeQuickActionSelection([]))).toEqual([]);
    // Never `''` — that value is spoken for.
    expect(encodeQuickActionSelection([])).not.toBe('');
  });
});

describe('isValidQuickActionOrder', () => {
  it('accepts the unset value, the sentinel, and a real list', () => {
    expect(isValidQuickActionOrder('')).toBe(true);
    expect(isValidQuickActionOrder(QUICK_ACTIONS_NONE)).toBe(true);
    expect(isValidQuickActionOrder('add-intern,assign-ticket')).toBe(true);
  });

  it('rejects a key that is not an action', () => {
    expect(isValidQuickActionOrder('add-intern,delete-everything')).toBe(false);
  });

  // The cap is injectable so this pins the mechanism whichever way the shipped
  // constant is set. It is what stops the editor saving past the cap:
  // `useStoredPreference` refuses a value that fails validation.
  it('rejects a list over a cap it is given', () => {
    const keys = QUICK_ACTION_CATALOG.slice(0, 6).map((a) => a.key);
    expect(isValidQuickActionOrder(keys.join(','), 5)).toBe(false);
    expect(isValidQuickActionOrder(keys.slice(0, 5).join(','), 5)).toBe(true);
  });

  // Shipped state today: the cap is off, so the whole catalog is a legal choice.
  it('accepts every action while the cap is off', () => {
    expect(QUICK_ACTIONS_MAX).toBeNull();
    const everything = QUICK_ACTION_CATALOG.map((a) => a.key).join(',');
    expect(isValidQuickActionOrder(everything)).toBe(true);
  });
});

describe('resolveQuickActions', () => {
  it('gives an account that has never chosen the first few of its catalog', () => {
    expect(keysOf(resolveQuickActions(null, ROLES.ADMIN, CATALOG))).toEqual([
      'first',
      'second',
      'third',
      'fourth',
      'fifth',
    ]);
  });

  // The default count is a separate question from the cap: "a sensible card out
  // of the box", not "how many fit". It stands whether or not the cap is armed.
  it('opens with the default count even when the catalog is longer', () => {
    expect(resolveQuickActions(null, ROLES.ADMIN, CATALOG)).toHaveLength(
      QUICK_ACTIONS_DEFAULT_COUNT
    );
    expect(quickActionsForRole(ROLES.ADMIN, CATALOG).length).toBeGreaterThan(
      QUICK_ACTIONS_DEFAULT_COUNT
    );
  });

  it('draws exactly what was chosen, in that order', () => {
    expect(keysOf(resolveQuickActions(['sixth', 'first'], ROLES.ADMIN, CATALOG))).toEqual([
      'sixth',
      'first',
    ]);
  });

  it('draws nothing for a deliberate empty selection', () => {
    expect(resolveQuickActions([], ROLES.ADMIN, CATALOG)).toEqual([]);
  });

  // A selection is five deliberate slots. An action added later must not evict
  // one of them; Settings is where it gets noticed.
  it('does not slip a newly added action into an existing selection', () => {
    const chosen = ['first', 'second', 'third', 'fourth', 'fifth'];
    const withNewcomer = [...CATALOG, { key: 'brand-new', label: 'New', roles: [ROLES.ADMIN] }];
    expect(keysOf(resolveQuickActions(chosen, ROLES.ADMIN, withNewcomer))).toEqual(chosen);
  });

  it('ignores a key that is no longer an action', () => {
    expect(keysOf(resolveQuickActions(['retired', 'second'], ROLES.ADMIN, CATALOG))).toEqual([
      'second',
    ]);
  });

  it('keeps the first position of a repeated key', () => {
    expect(keysOf(resolveQuickActions(['third', 'first', 'third'], ROLES.ADMIN, CATALOG))).toEqual([
      'third',
      'first',
    ]);
  });

  it('drops a key the role cannot use without disturbing the rest', () => {
    expect(keysOf(resolveQuickActions(['third', 'second'], ROLES.MENTOR, CATALOG))).toEqual([
      'second',
    ]);
  });

  // The role-change case: nothing migrates a stored selection when an account's
  // role changes, so it has to degrade on its own — to an empty card that says so,
  // never to somebody else's actions.
  it('resolves to nothing when no chosen key belongs to the role', () => {
    expect(resolveQuickActions(['first', 'third'], ROLES.MENTOR, CATALOG)).toEqual([]);
  });

  it('gives a role with no actions an empty list rather than everyone else’s', () => {
    expect(resolveQuickActions(null, ROLES.INTERN, CATALOG)).toEqual([]);
    expect(resolveQuickActions(['first'], ROLES.INTERN, CATALOG)).toEqual([]);
  });

  it('truncates a selection longer than a cap it is given', () => {
    const six = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];
    expect(resolveQuickActions(six, ROLES.ADMIN, CATALOG, 5)).toHaveLength(5);
  });

  // With the cap off, a selection of everything draws everything — which is the
  // point of turning it off.
  it('draws a selection of every action while the cap is off', () => {
    const six = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];
    expect(keysOf(resolveQuickActions(six, ROLES.ADMIN, CATALOG))).toEqual(six);
  });
});

describe('availableQuickActions', () => {
  it('offers what the default selection left out, in catalog order', () => {
    expect(keysOf(availableQuickActions(null, ROLES.ADMIN, CATALOG))).toEqual(['sixth']);
  });

  it('offers everything the role has when nothing is chosen', () => {
    expect(keysOf(availableQuickActions([], ROLES.ADMIN, CATALOG))).toEqual([
      'first',
      'second',
      'third',
      'fourth',
      'fifth',
      'sixth',
    ]);
  });

  it('never offers an action the role cannot use', () => {
    expect(keysOf(availableQuickActions([], ROLES.MENTOR, CATALOG))).toEqual([
      'second',
      'mentor-only',
    ]);
  });

  it('never offers something already chosen', () => {
    const offered = keysOf(availableQuickActions(['sixth', 'first'], ROLES.ADMIN, CATALOG));
    expect(offered).not.toContain('sixth');
    expect(offered).not.toContain('first');
  });
});

describe('the shipped catalog', () => {
  it('gives every action a unique key, a label, an icon and at least one role', () => {
    const keys = QUICK_ACTION_CATALOG.map((action) => action.key);
    expect(new Set(keys).size).toBe(keys.length);

    QUICK_ACTION_CATALOG.forEach((action) => {
      expect(action.label).toBeTruthy();
      expect(action.icon).toBeTruthy();
      expect(action.roles.length).toBeGreaterThan(0);
    });
  });

  it('gives every action exactly one behaviour — navigate, open, or pending', () => {
    QUICK_ACTION_CATALOG.forEach((action) => {
      const kinds = [action.to, action.opens, action.pending].filter(Boolean);
      expect(kinds).toHaveLength(1);
    });
  });

  // One admission is honest, two make "Soon" a pattern. `mark-absence` is the
  // one, and it is pending because the Attendance model has no write path for
  // absence at all — not for want of a modal.
  it('carries exactly one pending action', () => {
    expect(QUICK_ACTION_CATALOG.filter((action) => action.pending)).toHaveLength(1);
  });

  // Each of these is decided somewhere other than the route file — a service
  // guard, a client gate, or the handbook — so a well-meaning `roles` edit here
  // would produce a row that 403s on submit, or one that quietly contradicts the
  // documented permissions.
  it('keeps the admin-only writes off the mentor card', () => {
    const mentorKeys = QUICK_ACTION_CATALOG.filter((action) =>
      action.roles.includes(ROLES.MENTOR)
    ).map((action) => action.key);

    expect(mentorKeys).not.toContain('update-readiness');
    expect(mentorKeys).not.toContain('recommend-intern');
    // The server would allow an assigned mentor to write this one; the handbook
    // and the profile panel say admin-only, and the handbook wins.
    expect(mentorKeys).not.toContain('write-evaluation');
    // `POST /api/workspaces` still accepts MENTOR — the handbook says it should not.
    expect(mentorKeys).not.toContain('new-workspace');
  });

  it('has actions for the admin and the mentor, and none for anyone else', () => {
    expect(resolveQuickActions(null, ROLES.ADMIN).length).toBeGreaterThan(0);
    expect(resolveQuickActions(null, ROLES.MENTOR).length).toBeGreaterThan(0);
    expect(resolveQuickActions(null, ROLES.INTERN)).toEqual([]);
    expect(resolveQuickActions(null, ROLES.LEADERSHIP)).toEqual([]);
  });

  // The default has to be worth keeping, since most accounts will never open the
  // editor: the queues an admin checks daily come before the reference-data pages.
  it('opens the admin card on the ticket and the two queues', () => {
    expect(keysOf(resolveQuickActions(null, ROLES.ADMIN)).slice(0, 3)).toEqual([
      'assign-ticket',
      'absence-requests',
      'staffing-requests',
    ]);
  });
});
