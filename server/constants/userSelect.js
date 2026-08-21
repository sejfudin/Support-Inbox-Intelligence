/**
 * The projection every query that returns *a person to look at* should use.
 *
 * Mongoose returns only the fields a projection names, so before this existed
 * roughly sixty sites each carried their own literal — `'fullname email'`,
 * `'fullname email role'`, `'fullname email status role hub'` and a dozen more
 * variations. That was survivable while a person was a name and an email. It
 * stopped being survivable when they gained a face: a payload whose projection
 * was not updated keeps rendering initials, and the same colleague shows a photo
 * on the board and initials in the ticket rail. Partial coverage of an avatar
 * reads as a bug, not as a missing field.
 *
 * So `avatarUrl` is not something a caller remembers to ask for — it is in the
 * base list, and the caller only names what it needs *on top* of a displayable
 * person:
 *
 *   populate('creator', userSelect())                 // fullname email avatarUrl
 *   populate('assignedTo', userSelect('role'))
 *   { path: 'user', select: userSelect('role', 'status', 'hub') }
 *
 * The next field that has to appear beside a name is one edit here.
 *
 * `avatarPath` is deliberately absent, and is `select: false` on the schema on
 * top of that: the client is given a URL and never a storage key.
 */
const USER_DISPLAY_FIELDS = ['fullname', 'email', 'avatarUrl'];

/**
 * `extraFields` accepts either separate arguments or space-separated strings, so
 * a call site can read however it already read. Duplicates are dropped, which
 * means passing a field that is already in the base list is harmless rather than
 * producing `'... email email'`.
 */
const userSelect = (...extraFields) => {
  const extras = extraFields
    .filter(Boolean)
    .flatMap((field) => String(field).split(/\s+/))
    .filter(Boolean);

  return [...new Set([...USER_DISPLAY_FIELDS, ...extras])].join(' ');
};

module.exports = { USER_DISPLAY_FIELDS, userSelect };
