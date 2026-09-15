const ticketDraftService = require('../services/ticketDraftService');
const { resolveActiveWorkspaceId } = require('../helpers/workspaceAuthz');
const { handleControllerError } = require('../helpers/controllerError');

// A draft belongs to whoever typed it: the account comes from the token and
// there is no id in any of these routes, the same shape as the other self-only
// endpoints (`/api/users/me/preferences`). The workspace still goes through
// `resolveActiveWorkspaceId`, so a stale `User.workspaceId` pointer resolves to
// `null` and answers "no draft" rather than reaching into a workspace the caller
// has since left. See `.claude/docs/security.md`.
const getTicketDraft = async (req, res, next) => {
  try {
    const workspaceId = await resolveActiveWorkspaceId({
      user: req.user,
      override: req.query?.workspaceId,
    });

    if (!workspaceId) {
      return res.status(200).json({ success: true, message: 'No draft', data: null });
    }

    const draft = await ticketDraftService.getDraft({ userId: req.user._id, workspaceId });

    res.status(200).json({ success: true, message: 'Ticket draft fetched', data: draft ?? null });
  } catch (error) {
    handleControllerError(res, error, next);
  }
};

const saveTicketDraft = async (req, res, next) => {
  try {
    const workspaceId = await resolveActiveWorkspaceId({
      user: req.user,
      override: req.body?.workspaceId,
    });

    const draft = await ticketDraftService.saveDraft({
      userId: req.user._id,
      workspaceId,
      input: req.body?.draft ?? req.body,
    });

    res.status(200).json({
      success: true,
      message: draft ? 'Ticket draft saved' : 'Ticket draft discarded',
      data: draft,
    });
  } catch (error) {
    handleControllerError(res, error, next);
  }
};

const deleteTicketDraft = async (req, res, next) => {
  try {
    const workspaceId = await resolveActiveWorkspaceId({
      user: req.user,
      override: req.query?.workspaceId,
    });

    if (workspaceId) {
      await ticketDraftService.deleteDraft({ userId: req.user._id, workspaceId });
    }

    res.status(200).json({ success: true, message: 'Ticket draft discarded', data: null });
  } catch (error) {
    handleControllerError(res, error, next);
  }
};

module.exports = {
  getTicketDraft,
  saveTicketDraft,
  deleteTicketDraft,
};
