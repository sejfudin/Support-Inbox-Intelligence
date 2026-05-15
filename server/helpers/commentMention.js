const HANDLE_ALLOWED_RE = /[^a-z0-9]/g;
const MENTION_TOKEN_RE = /(^|\s)@([a-z0-9][a-z0-9._-]{0,29})/gi;

const toStringId = (value) => {
  if (!value) return null;

  if (typeof value === 'string') return value;
  if (typeof value.toString === 'function') return value.toString();

  return null;
};

const baseHandleFromFullname = (fullname = '') => {
  const first = String(fullname).trim().split(/\s+/)[0] || '';
  const normalized = first.toLowerCase().replace(HANDLE_ALLOWED_RE, '');

  return normalized || 'user';
};

const buildMentionDirectory = (users = []) => {
  const directory = [];
  const used = new Map();

  const sorted = [...users].sort((a, b) =>
    `${a?.fullname || ''}-${a?._id || ''}`.localeCompare(`${b?.fullname || ''}-${b?._id || ''}`)
  );

  for (const user of sorted) {
    const userId = toStringId(user?._id);
    if (!userId) continue;

    const base = baseHandleFromFullname(user?.fullname);
    const nextCount = (used.get(base) || 0) + 1;
    used.set(base, nextCount);

    const handle = nextCount === 1 ? base : `${base}${nextCount}`;

    directory.push({
      userId,
      handle,
      fullname: user?.fullname || '',
      email: user?.email || '',
    });
  }

  const byHandle = new Map(directory.map((d) => [d.handle, d]));
  return { directory, byHandle };
};

const extractMentionHandles = (content = '') => {
  const found = new Set();
  let match;

  while ((match = MENTION_TOKEN_RE.exec(String(content))) !== null) {
    const handle = (match[2] || '').toLowerCase();
    if (handle) found.add(handle);
  }

  return [...found];
};

module.exports = {
  buildMentionDirectory,
  extractMentionHandles,
};
