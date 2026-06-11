const Category = require('../models/Category');

const DEFAULT_CATEGORIES = [
  { name: 'Bug', color: '#ef4444' },
  { name: 'Feature', color: '#3b82f6' },
  { name: 'Refactor', color: '#8b5cf6' },
  { name: 'Fix', color: '#f97316' },
];

const seedDefaultCategories = async (workspaceId) => {
  const docs = DEFAULT_CATEGORIES.map((c) => ({ ...c, workspace: workspaceId }));
  await Category.insertMany(docs);
};

const getWorkspaceCategories = async (workspaceId) => {
  return Category.find({ workspace: workspaceId }).sort({ createdAt: 1 }).lean();
};

const createCategory = async ({
  name,
  color = '#6366f1',
  descriptionTemplate = '',
  workspaceId,
}) => {
  return Category.create({ name, color, descriptionTemplate, workspace: workspaceId });
};

const updateCategory = async (categoryId, { name, color, descriptionTemplate }) => {
  const updates = {};
  if (name !== undefined) updates.name = name;
  if (color !== undefined) updates.color = color;
  if (descriptionTemplate !== undefined) updates.descriptionTemplate = descriptionTemplate;

  const category = await Category.findByIdAndUpdate(
    categoryId,
    { $set: updates },
    { returnDocument: 'after', runValidators: true }
  );
  if (!category) throw new Error('Category not found');
  return category;
};

const deleteCategory = async (categoryId) => {
  const category = await Category.findByIdAndDelete(categoryId);
  if (!category) throw new Error('Category not found');
  return { message: 'Category deleted' };
};

module.exports = {
  seedDefaultCategories,
  getWorkspaceCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};
