import { useEffect, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { DEFAULT_STATUS_DRAFTS } from '@/helpers/ticketStatus';
import {
  applyWorkspaceBehaviorFlagPatch,
  toggleStatusBehaviorFlag,
} from '@/helpers/statusBehaviorFlags';

// Literal hexes on purpose: these are the swatches an admin picks a status colour
// *from*, and the chosen value is persisted on the status record and rendered
// through `style`. They are data, not the app's styling — a status colour has to
// stay the colour that was chosen, in both themes and under the colour-blind
// palette, or every workspace's board would silently repaint.
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

const ColorPicker = ({ value, onChange, dataTestPrefix = 'ticket-status' }) => (
  <div className="flex flex-wrap gap-1.5">
    {PRESET_COLORS.map((color) => (
      <button
        key={color}
        type="button"
        onClick={() => onChange(color)}
        className="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110"
        // The selection ring, unlike the swatches, is chrome — it was a literal
        // slate `#1e293b`, which is all but invisible against a dark-mode card,
        // so the picker gave no indication of which colour was chosen.
        style={{
          backgroundColor: color,
          borderColor: value === color ? 'hsl(var(--foreground))' : 'transparent',
        }}
        aria-label={color}
        data-test={`${dataTestPrefix}-color-option-${color.replace('#', '')}`}
      />
    ))}
  </div>
);

const getItemId = (item, index) => item._id || item.id || `draft-${index}`;

const FlagFields = ({ item, onChange, idPrefix = 'ticket-status' }) => (
  <div className="grid gap-2 sm:grid-cols-3">
    <label htmlFor={`${idPrefix}-backlog-checkbox`} className="flex items-start gap-2 text-xs">
      <Checkbox
        id={`${idPrefix}-backlog-checkbox`}
        checked={Boolean(item.isBacklog)}
        onCheckedChange={(checked) =>
          onChange(toggleStatusBehaviorFlag(item, 'isBacklog', Boolean(checked)))
        }
        data-test={`${idPrefix}-backlog-checkbox`}
      />
      <span>
        <span className="font-medium text-foreground">Backlog</span>
        <span className="block text-muted-foreground">Separate inbox, excluded from board</span>
      </span>
    </label>
    <label htmlFor={`${idPrefix}-tracks-time-checkbox`} className="flex items-start gap-2 text-xs">
      <Checkbox
        id={`${idPrefix}-tracks-time-checkbox`}
        checked={Boolean(item.tracksTime)}
        onCheckedChange={(checked) =>
          onChange(toggleStatusBehaviorFlag(item, 'tracksTime', Boolean(checked)))
        }
        data-test={`${idPrefix}-tracks-time-checkbox`}
      />
      <span>
        <span className="font-medium text-foreground">Tracks time</span>
        <span className="block text-muted-foreground">Starts time tracking when active</span>
      </span>
    </label>
    <label htmlFor={`${idPrefix}-done-checkbox`} className="flex items-start gap-2 text-xs">
      <Checkbox
        id={`${idPrefix}-done-checkbox`}
        checked={Boolean(item.isDone)}
        onCheckedChange={(checked) =>
          onChange(toggleStatusBehaviorFlag(item, 'isDone', Boolean(checked)))
        }
        data-test={`${idPrefix}-done-checkbox`}
      />
      <span>
        <span className="font-medium text-foreground">Done</span>
        <span className="block text-muted-foreground">Counts as completed in analytics</span>
      </span>
    </label>
  </div>
);

function SortableStatusRow({
  item,
  index,
  onUpdate,
  onRemove,
  canRemove,
  dataTestPrefix = 'ticket-status',
}) {
  const id = getItemId(item, index);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item);

  useEffect(() => {
    if (!editing) {
      setDraft(item);
    }
  }, [item, editing]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  const saveEdit = () => {
    if (!draft.label?.trim()) return;
    onUpdate(index, { ...draft, label: draft.label.trim() });
    setEditing(false);
  };

  const cancelEdit = () => {
    setDraft(item);
    setEditing(false);
  };

  if (editing) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="rounded-[var(--r-control)] border border-border bg-muted/50 p-3 space-y-3"
      >
        <Input
          value={draft.label}
          onChange={(e) => setDraft({ ...draft, label: e.target.value })}
          className="h-9"
          autoFocus
          data-test={`${dataTestPrefix}-edit-label-input-${id}`}
          onKeyDown={(e) => {
            if (e.key === 'Enter') saveEdit();
            if (e.key === 'Escape') cancelEdit();
          }}
        />
        <ColorPicker
          value={draft.color}
          onChange={(color) => setDraft({ ...draft, color })}
          dataTestPrefix={dataTestPrefix}
        />
        <FlagFields
          item={draft}
          onChange={(next) => setDraft({ ...draft, ...next })}
          idPrefix={`${dataTestPrefix}-edit-${id}`}
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={saveEdit}
            disabled={!draft.label?.trim()}
            data-test={`${dataTestPrefix}-edit-save-button-${id}`}
          >
            <Check className="h-3.5 w-3.5 mr-1" />
            Save
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={cancelEdit}
            data-test={`${dataTestPrefix}-edit-cancel-button-${id}`}
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between rounded-[var(--r-control)] border border-border px-3 py-2.5 hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          className="cursor-grab text-muted-foreground hover:text-muted-foreground touch-none"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          data-test={`${dataTestPrefix}-drag-button-${id}`}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
        <div className="min-w-0">
          <span className="text-sm font-medium text-foreground block truncate">{item.label}</span>
          <span className="text-[10px] text-muted-foreground">
            {[item.isBacklog && 'Backlog', item.tracksTime && 'Tracks time', item.isDone && 'Done']
              .filter(Boolean)
              .join(' · ') || 'Main board'}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => {
            setDraft(item);
            setEditing(true);
          }}
          className="p-1.5 rounded-[var(--r-control)] text-muted-foreground hover:text-foreground hover:bg-muted"
          aria-label="Edit status"
          data-test={`${dataTestPrefix}-edit-trigger-button-${id}`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        {canRemove && (
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="p-1.5 rounded-[var(--r-control)] text-muted-foreground hover:text-[hsl(var(--tone-danger-fg))] hover:bg-[hsl(var(--tone-danger)/0.15)]"
            aria-label="Remove status"
            data-test={`${dataTestPrefix}-remove-button-${id}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function TicketStatusEditor({
  items,
  onChange,
  minItems = 1,
  dataTestPrefix = 'ticket-status',
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState({
    label: '',
    color: PRESET_COLORS[5],
    isBacklog: false,
    tracksTime: false,
    isDone: false,
  });

  const sortableIds = items.map((item, index) => getItemId(item, index));

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sortableIds.indexOf(active.id);
    const newIndex = sortableIds.indexOf(over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    onChange(arrayMove(items, oldIndex, newIndex));
  };

  const updateItem = (index, patch) => {
    onChange(applyWorkspaceBehaviorFlagPatch(items, index, patch));
  };

  const removeItem = (index) => {
    if (items.length <= minItems) return;
    onChange(items.filter((_, i) => i !== index));
  };

  const addItem = () => {
    if (!newItem.label.trim()) return;
    const draftRow = {
      label: newItem.label.trim(),
      color: newItem.color,
      isBacklog: newItem.isBacklog,
      tracksTime: newItem.tracksTime,
      isDone: newItem.isDone,
    };
    const nextItems = [...items, draftRow];
    onChange(applyWorkspaceBehaviorFlagPatch(nextItems, nextItems.length - 1, draftRow));
    setNewItem({
      label: '',
      color: PRESET_COLORS[5],
      isBacklog: false,
      tracksTime: false,
      isDone: false,
    });
    setShowAdd(false);
  };

  const mainBoardCount = items.filter((s) => !s.isBacklog).length;

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Drag to reorder columns. Each status can have at most one of Backlog, Tracks time, or Done.
        Turning a flag on moves it from any other status that had it.
      </p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-1.5">
            {items.map((item, index) => (
              <SortableStatusRow
                key={getItemId(item, index)}
                item={item}
                index={index}
                onUpdate={updateItem}
                onRemove={removeItem}
                canRemove={items.length > minItems && (!item.isBacklog || mainBoardCount > 0)}
                dataTestPrefix={dataTestPrefix}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {showAdd ? (
        <div className="rounded-[var(--r-control)] border border-border bg-muted/50 p-3 space-y-3">
          <Input
            placeholder="Status name"
            value={newItem.label}
            onChange={(e) => setNewItem({ ...newItem, label: e.target.value })}
            className="h-9"
            autoFocus
            data-test={`${dataTestPrefix}-add-label-input`}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addItem();
              if (e.key === 'Escape') setShowAdd(false);
            }}
          />
          <ColorPicker
            value={newItem.color}
            onChange={(color) => setNewItem({ ...newItem, color })}
            dataTestPrefix={dataTestPrefix}
          />
          <FlagFields
            item={newItem}
            onChange={(patch) => setNewItem({ ...newItem, ...patch })}
            idPrefix={`${dataTestPrefix}-add`}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={addItem}
              disabled={!newItem.label.trim()}
              data-test={`${dataTestPrefix}-add-submit-button`}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add status
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowAdd(false)}
              data-test={`${dataTestPrefix}-add-cancel-button`}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowAdd(true)}
          data-test={`${dataTestPrefix}-add-open-button`}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add status
        </Button>
      )}
    </div>
  );
}

export { DEFAULT_STATUS_DRAFTS };
