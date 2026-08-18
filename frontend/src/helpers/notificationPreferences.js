/**
 * Which notification types reach the bell.
 *
 * This is a *display* filter, not a subscription: the server still writes every
 * notification, and muting a group hides it from the dropdown and stops it
 * counting toward the unread dot. Turning delivery off at the source — and
 * anything that has to arrive by email, like a digest — would additionally need
 * the notification service to read `User.preferences` before it writes.
 *
 * Cached as one comma-separated list of muted group keys and stored on the user
 * record as a real array, so a new group defaults to "on" without a migration:
 * an unknown key is simply not in the list.
 */

export const NOTIFICATION_MUTED_STORAGE_KEY = 'notify-muted';

/** Every group's `types` come from the enum on `server/models/Notification.js`. */
export const NOTIFICATION_GROUPS = [
  {
    key: 'mentions',
    label: 'Mentions and comments',
    hint: 'Someone @mentions you, or comments on a ticket you follow.',
    types: ['ticket_mention', 'ticket_comment', 'mentor_note_mention'],
  },
  {
    key: 'assignments',
    label: 'Assigned to me',
    hint: 'You are made the assignee of a ticket.',
    types: ['ticket_assigned'],
  },
  {
    key: 'programme',
    label: 'Programme updates',
    hint: 'Recommendations, evaluations, readiness and specialization changes.',
    types: [
      'recommendation_created',
      'recommendation_status_changed',
      'recommendation_not_placed',
      'intern_placed',
      'evaluation_created',
      'readiness_updated',
      'specialization_assigned',
      'specialization_reassigned',
      'specialization_mentor_changed',
      'specialization_cleared',
      'intern_status_changed',
      'intern_expected_end_date_changed',
      'intern_documentation_updated',
      'intern_request_from_leadership',
      'intern_mentor_note_shared',
    ],
  },
  {
    key: 'reminders',
    label: 'Daily reminder',
    hint: 'The nudge to record attendance and post your daily.',
    types: ['daily_attendance_reminder'],
  },
];

const KNOWN_KEYS = NOTIFICATION_GROUPS.map((group) => group.key);

export const parseMutedGroups = (stored) =>
  String(stored || '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => KNOWN_KEYS.includes(value));

export const serializeMutedGroups = (keys) =>
  keys.filter((key) => KNOWN_KEYS.includes(key)).join(',');

/** A stored list is valid when every entry is a group we still ship. */
export const isValidMutedGroups = (value) => {
  const parts = String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.every((part) => KNOWN_KEYS.includes(part));
};

const mutedTypeSet = (mutedKeys) =>
  new Set(
    NOTIFICATION_GROUPS.filter((group) => mutedKeys.includes(group.key)).flatMap(
      (group) => group.types
    )
  );

/**
 * Types with no group of their own are never hidden — a notification the reader
 * has no switch for must not be silently swallowed by this filter.
 */
export const filterNotifications = (items = [], mutedKeys = []) => {
  if (mutedKeys.length === 0) return items;
  const hidden = mutedTypeSet(mutedKeys);
  return items.filter((item) => !hidden.has(item?.type));
};
