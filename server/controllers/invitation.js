const invitationService = require("../services/invitationService");

exports.getMyInvitations = async (req, res, next) => {
  try {
    const invitations = await invitationService.listUserInvitations(req.user._id);
    res.json(invitations);
  } catch (error) {
    next(error);
  }
};

exports.acceptInvitation = async (req, res, next) => {
  try {
    const result = await invitationService.acceptInvitation({
      invitationId: req.params.id,
      userId: req.user._id,
    });
    res.json(result);
  } catch (error) {
    if (error.message === "Invitation not found") {
      return res.status(404).json({ message: error.message });
    }
    if (error.message === "Workspace not found") {
      return res.status(404).json({ message: error.message });
    }
    next(error);
  }
};

exports.declineInvitation = async (req, res, next) => {
  try {
    const result = await invitationService.declineInvitation({
      invitationId: req.params.id,
      userId: req.user._id,
    });
    res.json(result);
  } catch (error) {
    if (error.message === "Invitation not found") {
      return res.status(404).json({ message: error.message });
    }
    next(error);
  }
};
