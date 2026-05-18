const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { requireWorkspaceManager } = require('../middleware/requireWorkspaceManager');
const {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} = require('../controllers/categories');

router.get('/', protect, getCategories);
router.post('/', protect, requireWorkspaceManager, createCategory);
router.patch('/:id', protect, requireWorkspaceManager, updateCategory);
router.delete('/:id', protect, requireWorkspaceManager, deleteCategory);

module.exports = router;
