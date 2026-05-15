const HANDLE_ALLOWED_RE = /[^a-z0-9]/g;
const MENTION_LOOKBACK_RE = /(?:^|\s)@([a-z0-9._-]*)$/i;
const MENTION_TOKEN_RE = /(^|\s)(@[a-z0-9][a-z0-9._-]{0,29})/gi;

const baseHandleFromFullname = (fullname = '') => {
  const first = String(fullname).trim().split(/\s+/)[0] || '';
  const normalized = first.toLowerCase().replace(HANDLE_ALLOWED_RE, '');
  return normalized || 'user';
};

export const buildMentionCandidates = (users = []) => {
  const used = new Map();

  const sorted = [...users].sort((a, b) =>
    `${a?.fullname || ''}-${a?._id || ''}`.localeCompare(`${b?.fullname || ''}-${b?._id || ''}`)
  );

  return sorted
    .map((user) => {
      const base = baseHandleFromFullname(user?.fullname);
      const next = (used.get(base) || 0) + 1;
      used.set(base, next);

      const handle = next === 1 ? base : `${base}${next}`;
      return {
        userId: user?._id,
        handle,
        fullname: user?.fullname || '',
        email: user?.email || '',
      };
    })
    .filter((u) => !!u.userId);
};

export const getMentionContext = (text, caretIndex) => {
  const safeText = String(text || '');
  const cursor = Number.isFinite(caretIndex) ? caretIndex : safeText.length;
  const before = safeText.slice(0, cursor);
  const match = before.match(MENTION_LOOKBACK_RE);
  if (!match) return null;

  const typed = (match[1] || '').toLowerCase();
  const atIndex = before.lastIndexOf('@');
  if (atIndex < 0) return null;

  return { query: typed, start: atIndex, end: cursor };
};

export const replaceMentionToken = (text, start, end, handle) => {
  const safe = String(text || '');
  const left = safe.slice(0, start);
  const right = safe.slice(end);
  return `${left}@${handle} ${right}`;
};

export const splitMentionsForRender = (content = '') => {
  const text = String(content || '');
  const result = [];
  let last = 0;
  let match;

  while ((match = MENTION_TOKEN_RE.exec(text)) !== null) {
    const full = match[0];
    const token = match[2];
    const tokenStart = match.index + full.indexOf(token);
    const tokenEnd = tokenStart + token.length;

    if (tokenStart > last) {
      result.push({ type: 'text', value: text.slice(last, tokenStart) });
    }
    result.push({ type: 'mention', value: token });
    last = tokenEnd;
  }

  if (last < text.length) {
    result.push({ type: 'text', value: text.slice(last) });
  }

  return result.length ? result : [{ type: 'text', value: text }];
};
