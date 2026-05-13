const attachmentImageService = require('../services/attachmentImage');

const handleError = (res, error) => {
  const status = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
  return res.status(status).json({
    success: false,
    message: error?.message || 'Attachment image operation failed.',
  });
};

const getTicketDescriptionImages = async (req, res) => {
  try {
    const { ticketId } = req.params;

    const data = await attachmentImageService.getEntityImages({
      entityType: attachmentImageService.ENTITY_TYPES.TICKET_DESCRIPTION,
      entityId: ticketId,
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return handleError(res, error);
  }
};

const uploadTicketDescriptionImages = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const uploadedByUserId = String(req.user._id);

    const data = await attachmentImageService.uploadEntityImages({
      entityType: attachmentImageService.ENTITY_TYPES.TICKET_DESCRIPTION,
      entityId: ticketId,
      files: req.files || [],
      uploadedByUserId,
    });

    return res.status(201).json({
      success: true,
      message: 'Description images uploaded successfully.',
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

const deleteTicketDescriptionImage = async (req, res) => {
  try {
    const { ticketId, imageId } = req.params;

    await attachmentImageService.deleteEntityImage({
      entityType: attachmentImageService.ENTITY_TYPES.TICKET_DESCRIPTION,
      entityId: ticketId,
      imageId,
    });

    return res.status(200).json({
      success: true,
      message: 'Description image deleted successfully.',
    });
  } catch (error) {
    return handleError(res, error);
  }
};

const deleteAllTicketDescriptionImages = async (req, res) => {
  try {
    const { ticketId } = req.params;

    await attachmentImageService.deleteAllEntityImages({
      entityType: attachmentImageService.ENTITY_TYPES.TICKET_DESCRIPTION,
      entityId: ticketId,
    });

    return res.status(200).json({
      success: true,
      message: 'All description images deleted successfully.',
    });
  } catch (error) {
    return handleError(res, error);
  }
};


const getCommentImages = async (req, res) => {
  try {
    const { commentId } = req.params;

    const data = await attachmentImageService.getEntityImages({
      entityType: attachmentImageService.ENTITY_TYPES.COMMENT,
      entityId: commentId,
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return handleError(res, error);
  }
};

const uploadCommentImages = async (req, res) => {
  try {
    const { commentId } = req.params;
    const uploadedByUserId = String(req.user._id);

    const data = await attachmentImageService.uploadEntityImages({
      entityType: attachmentImageService.ENTITY_TYPES.COMMENT,
      entityId: commentId,
      files: req.files || [],
      uploadedByUserId,
    });

    return res.status(201).json({
      success: true,
      message: 'Comment images uploaded successfully.',
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

const deleteCommentImage = async (req, res) => {
  try {
    const { commentId, imageId } = req.params;

    await attachmentImageService.deleteEntityImage({
      entityType: attachmentImageService.ENTITY_TYPES.COMMENT,
      entityId: commentId,
      imageId,
    });

    return res.status(200).json({
      success: true,
      message: 'Comment image deleted successfully.',
    });
  } catch (error) {
    return handleError(res, error);
  }
};

const deleteAllCommentImages = async (req, res) => {
  try {
    const { commentId } = req.params;

    await attachmentImageService.deleteAllEntityImages({
      entityType: attachmentImageService.ENTITY_TYPES.COMMENT,
      entityId: commentId,
    });

    return res.status(200).json({
      success: true,
      message: 'All comment images deleted successfully.',
    });
  } catch (error) {
    return handleError(res, error);
  }
};

module.exports = {
  getTicketDescriptionImages,
  uploadTicketDescriptionImages,
  deleteTicketDescriptionImage,
  deleteAllTicketDescriptionImages,
  getCommentImages,
  uploadCommentImages,
  deleteCommentImage,
  deleteAllCommentImages,
};
