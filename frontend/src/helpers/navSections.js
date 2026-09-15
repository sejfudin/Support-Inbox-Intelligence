/**
 * Which sidebar sections are collapsed, and what a collapsed one still has to say.
 *
 * **Per device, not per account.** It is a function of physical screen size
 * rather than of taste: you close Admin on a 13" laptop because ten rows do not
 * fit; on a 27" monitor there is nothing to fix, and an account preference would
 * carry the laptop's compromise onto the desktop. The row is declared in
 * `context/ThemeConfigContext.jsx`'s table anyway with `PREFERENCE_SCOPE.DEVICE` —
 * the table is where a preference is declared whether or not the sync layer
 * carries it.
 *
 * **What is stored is the CLOSED list, not the open one.** Same trick as
 * `mutedNotificationGroups`: a section added in a later release is simply not in
 * anybody's stored list, so it defaults to open without a migration. Storing the
 * open list would mean every person who has ever collapsed anything stops seeing
 * new sections permanently, and nothing would look broken.
 *
 * Cached as one comma-separated string because that is what the preference layer
 * carries (`useStoredPreference` is string-in, string-out).
 */

export const NAV_SECTIONS_STORAGE_KEY = 'nav-sections-closed';

/**
 * Every section key, stable and explicit.
 *
 * Deliberately not derived from the section title: retitling "Boards" would
 * otherwise silently reopen it for everyone who had closed it, and the storage
 * key of a person's choice should not depend on copy.
 */
export const NAV_SECTION_KEYS = [
  'access',
  'workspace',
  'boards',
  'mentoring',
  'internship',
  'admin',
];

const isKnown = (key) => NAV_SECTION_KEYS.includes(key);

/** A stored comma string to its trimmed, non-empty entries. */
const splitEntries = (stored) =>
  stored
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

/** A stored string, or an array, to a clean list of section keys we still ship. */
export const parseClosedSections = (stored) => {
  if (Array.isArray(stored)) return stored.filter(isKnown);
  if (typeof stored !== 'string') return [];
  return splitEntries(stored).filter(isKnown);
};

export const serializeClosedSections = (keys) =>
  (Array.isArray(keys) ? keys : []).filter(isKnown).join(',');

/**
 * A stored list is valid when every entry is a section we still ship. An unknown
 * key makes the whole string invalid so the preference layer falls back to "all
 * open" rather than half-applying a list left by an older build.
 */
export const isValidClosedSections = (value) => {
  if (typeof value !== 'string') return false;
  return splitEntries(value).every(isKnown);
};

/**
 * Which section holds the route the person is looking at, or `null`.
 *
 * `isActive` is injected rather than imported so this stays a pure function with
 * no router dependency — the sidebar passes a `matchPath` closure, and a test
 * passes whatever it likes.
 */
export const findActiveSectionKey = (sections, isActive) => {
  if (!Array.isArray(sections) || typeof isActive !== 'function') return null;
  const match = sections.find((section) =>
    (section?.items || []).some((item) => item && !item.hidden && isActive(item.to))
  );
  return match?.key ?? null;
};

/**
 * The set of sections that render open.
 *
 * - `allOpen` overrides everything — the collapsed icon rail (no header to click,
 *   so a remembered "closed" would hide rows with no way to get them back) and a
 *   running what's-new tour (five of its six nav steps point inside Admin).
 * - `forcedOpen` is how the section holding the active route gets opened. It is
 *   deliberately *not* the stored list: writing it back would mean navigating
 *   permanently reopens sections the person closed.
 * - Anything not in the closed list is open, which is what makes a newly added
 *   section appear for an account that has closed things before.
 * - `singleOpen` collapses that down to **one** section at a time, which is what
 *   the sidebar actually renders: opening Boards closes Workspace. It is applied
 *   last, on top of the closed list, rather than being baked into storage — the
 *   rail and the tour still need *every* section open at once, and a store that
 *   could only express one open section could not describe that state at all.
 *   When more than one qualifies (a stored list from before a section shipped, say)
 *   the tie goes to `forcedOpen` — the section you are actually looking at wins
 *   over one that is merely absent from the list.
 *
 * Corrupt input degrades to all-open rather than throwing. This is the app shell;
 * there is no screen left to show an error on.
 */
export const resolveOpenSections = (
  sections,
  closed,
  { forcedOpen = [], allOpen = false, singleOpen = false } = {}
) => {
  const keys = (Array.isArray(sections) ? sections : [])
    .map((section) => section?.key)
    .filter(Boolean);

  if (allOpen) return new Set(keys);

  const closedSet = new Set(parseClosedSections(closed));
  const forcedSet = new Set(Array.isArray(forcedOpen) ? forcedOpen : [...(forcedOpen || [])]);

  const open = keys.filter((key) => !closedSet.has(key) || forcedSet.has(key));

  if (singleOpen && open.length > 1) {
    return new Set([open.find((key) => forcedSet.has(key)) ?? open[0]]);
  }

  return new Set(open);
};

/**
 * The closed list that leaves `openKey` — and nothing else — open.
 *
 * Single-open still stores a *closed* list rather than the one open key, so the
 * storage format and everything written about it hold: `null` closes everything,
 * and a section that ships later is simply absent from the list, which
 * `resolveOpenSections` reads as "not closed" rather than as a missing entry it has
 * to guess about.
 */
export const closedListFor = (sections, openKey) =>
  serializeClosedSections(
    (Array.isArray(sections) ? sections : [])
      .map((section) => section?.key)
      .filter((key) => key && key !== openKey)
  );

/** Matches `NavItem`'s own clamp, so a header and a row never disagree. */
export const clampBadge = (count) => (count > 99 ? '99+' : String(count));

/**
 * What a closed section still has to show on its header.
 *
 * A closed section must not swallow a signal that was trying to reach someone
 * from anywhere in the app. The amber dot on Absence Requests carries a comment
 * saying exactly that — a time-away request nobody notices goes stale on the day
 * it was asked for — and the staffing and invitation counts are the same kind of
 * thing. So both roll up to the header.
 *
 * `label` names them, because a dot on its own says nothing about what is
 * waiting. It feeds the header's accessible name, the way `NavItem` builds its
 * rail tooltip's suffix out of `dotLabel`.
 *
 * `isNew` rides along for the same reason and is the weakest of the three: a row a
 * release added or changed carries a NEW pill (see `useNewFeatureRoutes`), and a
 * folded section would otherwise be exactly where nobody finds out. It is deliberately
 * *not* summed or named per row — "something in here is new" is the whole message, and
 * a header listing which rows are new would be a changelog in a nav.
 */
export const rollupSignals = (items) => {
  const visible = (Array.isArray(items) ? items : []).filter((item) => item && !item.hidden);

  const dotted = visible.filter((item) => item.dot);
  const anyNew = visible.some((item) => item.isNew);
  const badged = visible.filter((item) => Number.isFinite(item.badge) && item.badge > 0);
  const badge = badged.reduce((sum, item) => sum + item.badge, 0);

  const label = [
    ...dotted.map((item) => item.dotLabel || item.label),
    ...badged.map((item) => `${clampBadge(item.badge)} ${item.label}`),
    // Last, and unqualified: it is the least urgent of the three and the only one
    // that is about the app rather than about work waiting for this person.
    ...(anyNew ? ['something new'] : []),
  ]
    .filter(Boolean)
    .join(', ');

  return {
    dot: dotted.length > 0,
    badge: badge > 0 ? badge : undefined,
    badgeText: badge > 0 ? clampBadge(badge) : '',
    isNew: anyNew,
    label,
  };
};
