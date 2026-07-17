const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  requireWorkspaceManager,
  workspaceManagerGuard,
} = require('../middleware/requireWorkspaceManager');
const Category = require('../models/Category');
const {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} = require('../controllers/categories');

// `:id` here is a category id, not a workspace id — resolve the workspace
// through the category so the manager check targets the right workspace.
const requireCategoryWorkspaceManager = workspaceManagerGuard(async (req) => {
  const category = await Category.findById(req.params.id).select('workspace').lean();
  if (!category) {
    const err = new Error('Category not found');
    err.statusCode = 404;
    throw err;
  }
  return category.workspace;
});

router.get('/', protect, getCategories);
router.post('/', protect, requireWorkspaceManager, createCategory);
router.patch('/:id', protect, requireCategoryWorkspaceManager, updateCategory);
router.delete('/:id', protect, requireCategoryWorkspaceManager, deleteCategory);

module.exports = router;
