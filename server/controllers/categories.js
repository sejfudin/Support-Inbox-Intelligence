const categoryService = require('../services/categoryService');

const getCategories = async (req, res) => {
  try {
    const isAdmin = req.user?.role === 'admin';
    const workspaceId =
      isAdmin && req.query.workspaceId ? req.query.workspaceId : req.user?.workspaceId;

    if (!workspaceId) {
      return res.status(400).json({ success: false, message: 'No workspace associated' });
    }

    const categories = await categoryService.getWorkspaceCategories(workspaceId);
    res.status(200).json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createCategory = async (req, res) => {
  try {
    const { name, color, workspaceId: bodyWorkspaceId } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Category name is required' });
    }

    const isAdmin = req.user?.role === 'admin';
    const workspaceId =
      isAdmin && bodyWorkspaceId ? bodyWorkspaceId : req.user?.workspaceId;

    if (!workspaceId) {
      return res.status(400).json({ success: false, message: 'No workspace associated' });
    }

    const category = await categoryService.createCategory({ name, color, workspaceId });
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color } = req.body;
    const category = await categoryService.updateCategory(id, { name, color });
    res.status(200).json({ success: true, data: category });
  } catch (error) {
    if (error.message === 'Category not found') {
      return res.status(404).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await categoryService.deleteCategory(id);
    res.status(200).json({ success: true, message: result.message });
  } catch (error) {
    if (error.message === 'Category not found') {
      return res.status(404).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getCategories, createCategory, updateCategory, deleteCategory };
