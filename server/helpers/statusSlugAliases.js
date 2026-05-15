const slugifyLabel = (label) =>
  String(label || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

/** Legacy / typo aliases → canonical default slugs (must exist in workspace config). */
const STATUS_SLUG_ALIASES = Object.freeze({
  todo: 'to do',
  'to-do': 'to do',
  open: 'to do',
  pending: 'to do',
  inprogress: 'in progress',
  'in-progress': 'in progress',
  working: 'in progress',
  active: 'in progress',
  staging: 'on staging',
  'on-staging': 'on staging',
  review: 'on staging',
  blocked: 'blocked',
  hold: 'blocked',
  done: 'done',
  complete: 'done',
  completed: 'done',
  closed: 'done',
  backlog: 'backlog',
});

const resolveTicketStatusSlug = (rawStatus, validSlugs, { fallbackSlug }) => {
  const normalized = slugifyLabel(rawStatus);
  const validSet = validSlugs instanceof Set ? validSlugs : new Set(validSlugs);

  if (!normalized) {
    return { slug: fallbackSlug, mapped: 'empty', from: rawStatus };
  }

  if (validSet.has(normalized)) {
    return { slug: normalized, mapped: 'exact', from: rawStatus };
  }

  const aliasTarget = STATUS_SLUG_ALIASES[normalized];
  if (aliasTarget && validSet.has(aliasTarget)) {
    return { slug: aliasTarget, mapped: 'alias', from: rawStatus };
  }

  const compact = normalized.replace(/\s/g, '');
  for (const slug of validSet) {
    if (slug.replace(/\s/g, '') === compact) {
      return { slug, mapped: 'compact', from: rawStatus };
    }
  }

  return { slug: fallbackSlug, mapped: 'fallback', from: rawStatus };
};

const pickFallbackSlug = (statuses) => {
  if (!statuses?.length) return 'to do';
  const backlog = statuses.find((s) => s.isBacklog);
  const main = statuses.find((s) => !s.isBacklog && !s.isDone);
  return main?.slug || backlog?.slug || statuses[0].slug;
};

const buildLifecyclePatch = (ticket, flags) => {
  const patch = {};
  const referenceDate = ticket.updatedAt || ticket.createdAt || new Date();

  if (flags?.isDone) {
    if (!ticket.doneAt) patch.doneAt = referenceDate;
  } else if (ticket.doneAt) {
    patch.doneAt = null;
  }

  if (flags?.tracksTime) {
    if (!ticket.inProgressAt) patch.inProgressAt = referenceDate;
  } else if (ticket.inProgressAt) {
    patch.inProgressAt = null;
  }

  return patch;
};

const patchIsEmpty = (patch) => Object.keys(patch).length === 0;

module.exports = {
  slugifyLabel,
  STATUS_SLUG_ALIASES,
  resolveTicketStatusSlug,
  pickFallbackSlug,
  buildLifecyclePatch,
  patchIsEmpty,
};
