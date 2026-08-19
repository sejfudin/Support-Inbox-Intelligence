/**
 * The UI preferences that follow the *account* rather than the browser.
 *
 * One table, because the model, the service's partial-merge validation and the
 * endpoint all need exactly the same answer to "is this a preference, and is
 * that a legal value for it". A new preference costs a row here and a row in
 * the frontend's `ThemeConfigContext` table — nothing else.
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
      'azure',
      'ocean',
      'teal',
      'forest',
      'amber',
      'sunset',
      'rose',
      'slate',
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

const USER_PREFERENCE_KEYS = [
  ...Object.keys(USER_PREFERENCE_DEFINITIONS),
  'mutedNotificationGroups',
];

const DEFAULT_USER_PREFERENCES = Object.freeze({
  ...Object.fromEntries(
    Object.entries(USER_PREFERENCE_DEFINITIONS).map(([key, definition]) => [
      key,
      definition.default,
    ])
  ),
  mutedNotificationGroups: [],
});

module.exports = {
  USER_PREFERENCE_DEFINITIONS,
  USER_PREFERENCE_KEYS,
  MUTED_NOTIFICATION_GROUP_VALUES,
  DEFAULT_USER_PREFERENCES,
};
