import { useState } from 'react';
import { Pencil, Trash2, Plus, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  RichTextEditor,
  RichTextEditorContent,
  RichTextEditorToolbar,
} from '@/components/ui/rich-text-editor';
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from '@/queries/categories';
import {
  normalizeTemplateForSave,
  templateHtmlToPlainText,
  templateTextToDescriptionHtml,
} from '@/helpers/ticketDescriptionTemplates';
import { toast } from 'sonner';

const PRESET_COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#6b7280',
];

const ColorPicker = ({ value, onChange }) => (
  <div className="flex flex-wrap gap-1.5">
    {PRESET_COLORS.map((color) => (
      <button
        key={color}
        type="button"
        onClick={() => onChange(color)}
        className="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110"
        style={{
          backgroundColor: color,
          borderColor: value === color ? '#1e293b' : 'transparent',
        }}
        aria-label={color}
      />
    ))}
  </div>
);

const TemplateEditor = ({ value, onChange }) => (
  <RichTextEditor
    value={value}
    onChange={onChange}
    placeholder="Ticket description template"
    className="min-h-44 overflow-hidden rounded-lg bg-white"
  >
    <div className="border-b border-gray-100 bg-gray-50/50 px-3 py-2">
      <RichTextEditorToolbar className="flex-wrap p-0" />
    </div>
    <RichTextEditorContent className="min-h-28 p-2" />
  </RichTextEditor>
);

const CategoryRow = ({ category, workspaceId }) => {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [color, setColor] = useState(category.color);
  const [descriptionTemplate, setDescriptionTemplate] = useState(
    templateTextToDescriptionHtml(category.descriptionTemplate)
  );

  const updateMutation = useUpdateCategory(workspaceId);
  const deleteMutation = useDeleteCategory(workspaceId);

  const handleSave = () => {
    if (!name.trim()) return;
    updateMutation.mutate(
      {
        id: category._id,
        name: name.trim(),
        color,
        descriptionTemplate: normalizeTemplateForSave(descriptionTemplate),
      },
      {
        onSuccess: () => {
          setEditing(false);
          toast.success('Category updated');
        },
        onError: () => toast.error('Failed to update category'),
      }
    );
  };

  const handleCancel = () => {
    setName(category.name);
    setColor(category.color);
    setDescriptionTemplate(templateTextToDescriptionHtml(category.descriptionTemplate));
    setEditing(false);
  };

  const handleDelete = () => {
    deleteMutation.mutate(category._id, {
      onSuccess: () => toast.success('Category deleted'),
      onError: () => toast.error('Failed to delete category'),
    });
  };

  if (editing) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-3">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-9"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') handleCancel();
          }}
        />
        <ColorPicker value={color} onChange={setColor} />
        <TemplateEditor value={descriptionTemplate} onChange={setDescriptionTemplate} />
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!name.trim() || updateMutation.isPending}
          >
            <Check className="h-3.5 w-3.5 mr-1" />
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={handleCancel}>
            <X className="h-3.5 w-3.5 mr-1" />
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2.5 hover:bg-gray-50 transition-colors">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <span
            className="h-3 w-3 rounded-full shrink-0"
            style={{ backgroundColor: category.color }}
          />
          <span className="text-sm font-medium text-gray-800">{category.name}</span>
        </div>
        {category.descriptionTemplate && (
          <p className="mt-1 line-clamp-2 whitespace-pre-line pl-5 text-xs text-muted-foreground">
            {templateHtmlToPlainText(category.descriptionTemplate)}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          aria-label="Edit category"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
          className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          aria-label="Delete category"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};

const CategorySettings = ({ workspaceId }) => {
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PRESET_COLORS[5]);
  const [newDescriptionTemplate, setNewDescriptionTemplate] = useState('');
  const [showForm, setShowForm] = useState(false);

  const { data: categoriesData, isLoading } = useCategories(workspaceId);
  const categories = categoriesData?.data || [];

  const createMutation = useCreateCategory(workspaceId);

  const handleCreate = () => {
    if (!newName.trim()) return;
    createMutation.mutate(
      {
        name: newName.trim(),
        color: newColor,
        descriptionTemplate: normalizeTemplateForSave(newDescriptionTemplate),
        workspaceId,
      },
      {
        onSuccess: () => {
          setNewName('');
          setNewColor(PRESET_COLORS[5]);
          setNewDescriptionTemplate('');
          setShowForm(false);
          toast.success('Category created');
        },
        onError: () => toast.error('Failed to create category'),
      }
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Ticket Categories</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Manage categories used to classify tickets in this workspace.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 rounded-lg bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No categories yet. Add one below.
        </p>
      ) : (
        <div className="space-y-1.5">
          {categories.map((cat) => (
            <CategoryRow key={cat._id} category={cat} workspaceId={workspaceId} />
          ))}
        </div>
      )}

      {showForm ? (
        <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <Input
            placeholder="Category name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="h-9"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') setShowForm(false);
            }}
          />
          <ColorPicker value={newColor} onChange={setNewColor} />
          <TemplateEditor value={newDescriptionTemplate} onChange={setNewDescriptionTemplate} />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={!newName.trim() || createMutation.isPending}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add category
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add category
        </Button>
      )}
    </div>
  );
};

export default CategorySettings;
