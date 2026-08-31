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
 */
const scopeDraftRefsToWorkspace = async (draft, workspaceId) => {
  const [status, category, blockingTicket, workspace] = await Promise.all([
    draft.status
      ? TicketStatus.findOne({ _id: draft.status, workspace: workspaceId }).select('_id').lean()
      : null,
    draft.category
      ? Category.findOne({ _id: draft.category, workspace: workspaceId }).select('_id').lean()
      : null,
    draft.blockedBy.ticket
      ? Ticket.findOne({ _id: draft.blockedBy.ticket, workspace: workspaceId }).select('_id').lean()
      : null,
    draft.assignedTo.length > 0
      ? Workspace.findById(workspaceId).select('members.user members.status').lean()
      : null,
  ]);

  const activeMemberIds = new Set(
    (workspace?.members || [])
      .filter((member) => member.status === 'active' && member.user)
      .map((member) => String(member.user))
  );

  return {
    ...draft,
    status: status ? draft.status : null,
    category: category ? draft.category : null,
    assignedTo: draft.assignedTo.filter((userId) => activeMemberIds.has(userId)),
    blockedBy: {
      ticket: blockingTicket ? draft.blockedBy.ticket : null,
      note: draft.blockedBy.note,
    },
  };
};

const assertWorkspace = (workspaceId) => {
  if (!workspaceId) {
    throw httpError('No workspace associated with this account.', 400);
  }
};

/** The account's draft in this workspace, or `null` — "no draft" is not an error. */
const getDraft = async ({ userId, workspaceId }) => {
  assertWorkspace(workspaceId);

  return TicketDraft.findOne({ user: userId, workspace: workspaceId })
    .populate(BLOCKER_POPULATE)
    .lean();
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

  const scoped = await scopeDraftRefsToWorkspace(normalized, workspaceId);

  const draft = await TicketDraft.findOneAndUpdate(
    { user: userId, workspace: workspaceId },
    { $set: { ...scoped, user: userId, workspace: workspaceId } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).populate(BLOCKER_POPULATE);

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
