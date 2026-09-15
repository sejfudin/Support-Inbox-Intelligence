const TicketDraft = require('../models/TicketDraft');
const TicketStatus = require('../models/TicketStatus');
const Category = require('../models/Category');
const Ticket = require('../models/Ticket');
const Workspace = require('../models/Workspace');
const { httpError } = require('../helpers/httpError');
const { sanitizeDescriptionHtml } = require('../helpers/htmlSanitize');
const { isDraftEmpty, normalizeDraftInput } = require('../helpers/ticketDraftRules');

// Same populate the ticket read uses for a blocker, and for the same reason: the
// form renders the linked ticket as "Ticket 12", so restoring a draft has to hand
// back the document rather than the bare id.
const BLOCKER_POPULATE = {
  path: 'blockedBy.ticket',
  select: 'subject taskNumber isArchived status',
  populate: { path: 'status', select: 'slug label color isDone' },
};

const sameRef = (a, b) => String(a ?? '') === String(b ?? '');

const sameIdSet = (a = [], b = []) => {
  if (a.length !== b.length) return false;
  const setB = new Set(b.map(String));
  return a.every((id) => setB.has(String(id)));
};

/**
 * Every reference in a draft, reduced to the ones that actually belong to this
 * workspace. Anything else becomes `null` (or drops out of `assignedTo`).
 *
 * **Dropped, not rejected**, which is the one place this differs from
 * `createTicket`. Two reasons, and both matter more than the error message:
 *
 * - It is the scoping guard. A draft is read back by its owner and rendered, so a
 *   foreign category or blocking ticket stored here would be a cross-workspace
 *   read through the populate above — the golden rule applies to a draft exactly
 *   as it does to a ticket (`.claude/docs/security.md`).
 * - Autosave cannot usefully fail. A category deleted while the modal is open, or
 *   an assignee whose membership was just revoked, would otherwise turn every
 *   subsequent keystroke into a 400 and silently stop saving what is being typed.
 *   Losing the chip is recoverable; losing the paragraph is not.
 *
 * `previous` is the draft as it is currently stored. A ref that is byte-identical
 * to the stored one was already validated against this same workspace on its own
 * write, and a status/category/ticket cannot move between workspaces — so it is
 * kept without another round trip. That collapses the common autosave (typing the
 * description, refs untouched) from up to four extra reads to none. A ref deleted
 * mid-session survives in the draft until the next open or the create attempt,
 * both of which re-check from scratch (`getDraft` passes no `previous`).
 */
const scopeDraftRefsToWorkspace = async (draft, workspaceId, previous = null) => {
  const statusUnchanged = Boolean(previous) && sameRef(previous.status, draft.status);
  const categoryUnchanged = Boolean(previous) && sameRef(previous.category, draft.category);
  const blockerUnchanged =
    Boolean(previous) && sameRef(previous.blockedBy?.ticket, draft.blockedBy.ticket);
  const assigneesUnchanged =
    Boolean(previous) && sameIdSet(previous.assignedTo || [], draft.assignedTo);

  const [status, category, blockingTicket, workspace] = await Promise.all([
    draft.status && !statusUnchanged
      ? TicketStatus.findOne({ _id: draft.status, workspace: workspaceId }).select('_id').lean()
      : null,
    draft.category && !categoryUnchanged
      ? Category.findOne({ _id: draft.category, workspace: workspaceId }).select('_id').lean()
      : null,
    draft.blockedBy.ticket && !blockerUnchanged
      ? Ticket.findOne({ _id: draft.blockedBy.ticket, workspace: workspaceId }).select('_id').lean()
      : null,
    draft.assignedTo.length > 0 && !assigneesUnchanged
      ? Workspace.findById(workspaceId).select('members.user members.status').lean()
      : null,
  ]);

  const keepStatus = Boolean(draft.status) && (statusUnchanged || Boolean(status));
  const keepCategory = Boolean(draft.category) && (categoryUnchanged || Boolean(category));
  const keepBlocker =
    Boolean(draft.blockedBy.ticket) && (blockerUnchanged || Boolean(blockingTicket));

  let assignedTo;
  if (draft.assignedTo.length === 0) {
    assignedTo = [];
  } else if (assigneesUnchanged) {
    assignedTo = draft.assignedTo;
  } else {
    const activeMemberIds = new Set(
      (workspace?.members || [])
        .filter((member) => member.status === 'active' && member.user)
        .map((member) => String(member.user))
    );
    assignedTo = draft.assignedTo.filter((userId) => activeMemberIds.has(String(userId)));
  }

  return {
    ...draft,
    status: keepStatus ? draft.status : null,
    category: keepCategory ? draft.category : null,
    assignedTo,
    blockedBy: {
      ticket: keepBlocker ? draft.blockedBy.ticket : null,
      note: draft.blockedBy.note,
    },
  };
};

const DRAFT_UPSERT_OPTS = { new: true, upsert: true, setDefaultsOnInsert: true };

// Autosave holds no lock against overlapping in-flight saves and marks a payload
// sent before the request returns, so two upserts can race the { user, workspace }
// unique index before any row exists. The loser gets E11000 — by then the row is
// there, so a plain update lands it, rather than the driver error surfacing as a
// 500.
const upsertDraft = async (filter, update) => {
  try {
    return await TicketDraft.findOneAndUpdate(filter, update, DRAFT_UPSERT_OPTS).populate(
      BLOCKER_POPULATE
    );
  } catch (err) {
    if (err?.code !== 11000) throw err;
    return TicketDraft.findOneAndUpdate(filter, update, { new: true }).populate(BLOCKER_POPULATE);
  }
};

const assertWorkspace = (workspaceId) => {
  if (!workspaceId) {
    throw httpError('No workspace associated with this account.', 400);
  }
};

/**
 * The account's draft in this workspace, or `null` — "no draft" is not an error.
 *
 * The stored refs are re-scoped on the way out, not only on the way in: a status,
 * category, blocker ticket or assignee deleted since the last save would
 * otherwise be handed back as a dangling id that the form cannot render and the
 * create call then rejects. No `previous` is passed, so every ref is re-checked.
 */
const getDraft = async ({ userId, workspaceId }) => {
  assertWorkspace(workspaceId);

  const stored = await TicketDraft.findOne({ user: userId, workspace: workspaceId }).lean();
  if (!stored) {
    return null;
  }

  const scoped = await scopeDraftRefsToWorkspace(stored, workspaceId);
  if (scoped.blockedBy.ticket) {
    await TicketDraft.populate(scoped, BLOCKER_POPULATE);
  }
  return scoped;
};

/**
 * Replace the account's draft in this workspace, or delete it when the form has
 * been emptied out.
 *
 * A whole-form replace rather than a patch: the client holds the form, the server
 * holds a copy of it, and merging two partial views of the same object is how a
 * field the user cleared comes back on the next restore.
 *
 * Returns the stored draft, or `null` when the empty form deleted it — the
 * caller reports that as an ordinary result, not a 404.
 */
const saveDraft = async ({ userId, workspaceId, input }) => {
  assertWorkspace(workspaceId);

  const normalized = normalizeDraftInput({
    ...input,
    // Rich text goes to a `dangerouslySetInnerHTML` sink on the way back out, so
    // it is sanitized on the way in — the same rule, and the same helper, as a
    // ticket description.
    description: sanitizeDescriptionHtml(input?.description),
  });

  if (isDraftEmpty(normalized)) {
    await TicketDraft.deleteOne({ user: userId, workspace: workspaceId });
    return null;
  }

  const previous = await TicketDraft.findOne({ user: userId, workspace: workspaceId })
    .select('status category blockedBy.ticket assignedTo')
    .lean();

  const scoped = await scopeDraftRefsToWorkspace(normalized, workspaceId, previous);

  const draft = await upsertDraft(
    { user: userId, workspace: workspaceId },
    { $set: { ...scoped, user: userId, workspace: workspaceId } }
  );

  return draft.toObject();
};

/** Discarding a draft that isn't there is a success — the end state is the same. */
const deleteDraft = async ({ userId, workspaceId }) => {
  assertWorkspace(workspaceId);

  await TicketDraft.deleteOne({ user: userId, workspace: workspaceId });
};

module.exports = {
  getDraft,
  saveDraft,
  deleteDraft,
};
