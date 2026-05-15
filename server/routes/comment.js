const express = require('express');
const router = express.Router();

const {
  createComment,
  getCommentsByTicketId,
  updateComment,
  deleteComment,
} = require('../controllers/comment');
const { protect } = require('../middleware/auth');

const { uploadImages } = require('../middleware/upload');
const {
  getCommentImages,
  uploadCommentImages,
  deleteCommentImage,
  deleteAllCommentImages,
} = require('../controllers/attachmentImage');

router.post('/', protect, createComment);

router.get('/:commentId/images', protect, getCommentImages);
router.post('/:commentId/images', protect, uploadImages, uploadCommentImages);
router.delete('/:commentId/images/:imageId', protect, deleteCommentImage);
router.delete('/:commentId/images', protect, deleteAllCommentImages);

router.get('/:id', protect, getCommentsByTicketId);
router.put('/', protect, updateComment);
router.delete('/', protect, deleteComment);

module.exports = router;
