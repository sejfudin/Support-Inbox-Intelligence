const commentService = require("../services/commentService");

exports.createComment = async (req, res, next) => {
  try {
    const { content, ticket } = req.body;

    const comment = await commentService.createComment({
      content,
      ticket,
      authorId: req.user._id,
      userWorkspaceId: req.user.workspaceId,
      role: req.user.role,
    });

    res.status(201).json(comment);
  } catch (err) {
    if (
      err.message === "Comment content is required" ||
      err.message.includes("too long")
    )
      return res.status(400).json({ message: err.message });
    if (err.message.includes("Unauthorized"))
      return res.status(403).json({ message: err.message });
    next(err);
  }
};

exports.getCommentsByTicketId = async (req, res, next) => {
  try {
    const comments = await commentService.getCommentsByTicketId(
      req.params.id,
      req.user.workspaceId,
      req.user.role,
    );
    res.json(comments);
  } catch (err) {
    if (err.message.includes("Unauthorized"))
      return res.status(403).json({ message: err.message });
    next(err);
  }
};

exports.updateComment = async (req, res, next) => {
  try {
    const { commentId, content } = req.body;
    const comment = await commentService.updateComment(
      commentId,
      content,
      req.user._id,
    );
    res.json(comment);
  } catch (err) {
    if (err.message === "Comment not found" || err.message.includes("too long"))
      return res.status(404).json({ message: err.message });
    if (err.message.includes("Unauthorized")) {
      return res.status(403).json({ message: err.message });
    }
    next(err);
  }
};

exports.deleteComment = async (req, res, next) => {
  try {
    const { commentId } = req.body;
    const result = await commentService.deleteComment(
      commentId,
      req.user._id,
      req.user.role,
    );
    res.json(result);
  } catch (err) {
    if (err.message === "Comment not found")
      return res.status(404).json({ message: err.message });
    if (err.message.includes("Unauthorized"))
      return res.status(403).json({ message: err.message });
    next(err);
  }
};
