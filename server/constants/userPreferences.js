/**
 * The UI preferences that follow the *account* rather than the browser.
 *
 * One table, because the model, the service's partial-merge validation and the
 * endpoint all need exactly the same answer to "is this a preference, and is
 * that a legal value for it". A new preference costs a row here and a row in
 * the frontend's `ThemeConfigContext` table — nothing else. Single-valued
 * preferences live in `USER_PREFERENCE_DEFINITIONS`; list-valued ones (muted
 * notification groups, quick-action order) in `USER_LIST_PREFERENCE_DEFINITIONS`
 * further down.
 *
 * Deliberately absent: **UI scale**. It is the one preference that is a function
 * of physical screen size and viewing distance rather than of the person's
 * taste, so it stays per-device in `localStorage`. See the matching comment in
 * `frontend/src/context/ThemeConfigContext.jsx`.
 */

/** Single-valued preferences: an enum and the value a fresh account starts on. */
const USER_PREFERENCE_DEFINITIONS = {
  // Light / dark / follow the OS. Owned by `next-themes` on the client.
  mode: { values: ['light', 'dark', 'system'], default: 'system' },
  // Accent palette id — mirrors `THEMES` in `frontend/src/lib/themes.js`.
  colorTheme: {
    values: [
      'default',
      'violet',
      'magenta',
      'ruby',
      'rose',
      'sunset',
      'teal',
      'ocean',
      'midnight',
      'ash',
      'mono',
    ],
    default: 'default',
  },
  density: { values: ['comfortable', 'compact'], default: 'comfortable' },
  contrast: { values: ['default', 'high'], default: 'default' },
  colorblind: { values: ['off', 'redgreen', 'blueyellow', 'grayscale'], default: 'off' },
  motion: { values: ['full', 'reduced'], default: 'full' },
  landingPage: { values: ['dashboard', 'tickets', 'board', 'dailies'], default: 'dashboard' },
  ticketsView: { values: ['list', 'board'], default: 'list' },
  assigneeDefault: { values: ['everyone', 'me'], default: 'everyone' },
  boardSort: { values: ['priority', 'points', 'due', 'newest'], default: 'priority' },
};

/**
 * Muted notification groups — a set rather than a single value, stored as a
 * list of group keys so a group we add later defaults to "on" without a
 * migration. Mirrors `NOTIFICATION_GROUPS` in
 * `frontend/src/helpers/notificationPreferences.js`.
 */
const MUTED_NOTIFICATION_GROUP_VALUES = [
  'mentions',
  'assignments',
  'reviews',
  'programme',
  'reminders',
];

/**
 * The dashboard quick actions, in the order the account dragged them into.
 * Mirrors `QUICK_ACTION_CATALOG` in `frontend/src/helpers/quickActions.js`.
 *
 * Same shape as the muted groups above and for the same reason: what is stored is
 * a list of **keys**, never the resolved list of actions, so a retired action is
 * ignored on read and a renamed label costs nothing.
 *
 * It is a *selection*, not a full ordering: an account picks at most
 * `QUICK_ACTIONS_MAX` of these and the rest are not on their dashboard. An empty
 * array is therefore a real, storable choice — "no quick actions" — and is not
 * the same state as the key being absent, which means "never chosen, show what
 * ships".
 *
 * The list spans every role that has a quick-actions card. Which of them a given
 * account may actually *use* is decided by the catalog's own `roles` field on the
 * client; this table only answers "is that a real action key". An order naming an
 * action the account's role cannot see is junk in a list, not an escalation —
 * every action's target keeps its own server guard.
 */
/* ==========================================================================
 * TODO(quick-actions): PUT THIS BACK TO 5 BEFORE THIS SHIPS.
 *
 * ⚠️  `null` means NO LIMIT, and it is not the intended behaviour. It was turned
 *     off deliberately and temporarily so every action could be put on a
 *     dashboard card at once and tested one by one.
 *
 *     This is the **server half** of the cap and it is the half that matters: a
 *     limit only the client honours is a limit until somebody posts by hand.
 *     `buildUpdate` reads it as `maxLength` and refuses an over-long selection
 *     with a 400 rather than truncating.
 *
 *     Flip it together with `QUICK_ACTIONS_MAX` in
 *     `frontend/src/helpers/quickActions.js` — that file carries the full note.
 *     Nothing else needs editing: the service branch and its test are already
 *     written for a number.
 * ========================================================================== */
const QUICK_ACTIONS_MAX = null;

const QUICK_ACTION_KEYS = [
  'assign-ticket',
  'absence-requests',
  'staffing-requests',
  'recommend-intern',
  'write-evaluation',
  'write-note',
  'update-readiness',
  'assign-specialization',
  'add-project',
  'add-intern',
  'attendance-today',
  'daily-insights',
  'manage-users',
  'new-workspace',
  'mark-absence',
  'my-interns',
  'workspace-dailies',
  'my-workspaces',
];

/**
 * List-valued preferences: an enum for the members, and the name one member goes
 * by in an error message.
 *
 * A table rather than a branch per key. `buildUpdate` had one hard-coded
 * `mutedNotificationGroups` case, and a second hard-coded case is how the third
 * one gets missed.
 *
 * Every list here is validated against its own enum and de-duplicated, so its
 * length is bounded by the enum. `maxLength` is for a list that is bounded by
 * something narrower than that — the quick-action selection is capped at five
 * because five is what the dashboard card has room for, and a sixth would be
 * stored and then silently never drawn.
 */
const USER_LIST_PREFERENCE_DEFINITIONS = {
  mutedNotificationGroups: {
    values: MUTED_NOTIFICATION_GROUP_VALUES,
    itemName: 'notification group',
  },
  quickActions: {
    values: QUICK_ACTION_KEYS,
    itemName: 'quick action',
    maxLength: QUICK_ACTIONS_MAX,
  },
};

const USER_LIST_PREFERENCE_KEYS = Object.keys(USER_LIST_PREFERENCE_DEFINITIONS);

const USER_PREFERENCE_KEYS = [
  ...Object.keys(USER_PREFERENCE_DEFINITIONS),
  ...USER_LIST_PREFERENCE_KEYS,
];

const DEFAULT_USER_PREFERENCES = Object.freeze({
  ...Object.fromEntries(
    Object.entries(USER_PREFERENCE_DEFINITIONS).map(([key, definition]) => [
      key,
      definition.default,
    ])
  ),
  ...Object.fromEntries(USER_LIST_PREFERENCE_KEYS.map((key) => [key, []])),
});

module.exports = {
  USER_PREFERENCE_DEFINITIONS,
  USER_PREFERENCE_KEYS,
  USER_LIST_PREFERENCE_DEFINITIONS,
  USER_LIST_PREFERENCE_KEYS,
  MUTED_NOTIFICATION_GROUP_VALUES,
  QUICK_ACTION_KEYS,
  QUICK_ACTIONS_MAX,
  DEFAULT_USER_PREFERENCES,
};
