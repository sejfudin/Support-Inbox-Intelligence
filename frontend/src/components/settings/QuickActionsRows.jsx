import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, RotateCcw, X } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { SettingsRow } from '@/components/settings/SettingsSection';
import { useThemeConfig } from '@/context/ThemeConfigContext';
import { useStoredPreference } from '@/hooks/useStoredPreference';
import {
  QUICK_ACTIONS_MAX,
  QUICK_ACTIONS_STORAGE_KEY,
  availableQuickActions,
  decodeQuickActionSelection,
  encodeQuickActionSelection,
  isValidQuickActionOrder,
  quickActionsForRole,
  resolveQuickActions,
} from '@/helpers/quickActions';

/**
 * The quick-actions editor: two zones and one drag.
 *
 * **On your dashboard** is the card, in order, capped at `QUICK_ACTIONS_MAX`.
 * **Available** is the rest of what this role may use.
 *
 * ⚠️  **TODO(quick-actions): the cap is currently `null` — no limit — on purpose,
 * so every action can be tested on a card. It must go back to 5 before this
 * ships.** See the banner on `QUICK_ACTIONS_MAX` in `helpers/quickActions.js`;
 * everything in this file that enforces it (`full`, the `n / max` counter, the
 * "Full" hint, `refuseCap`) is already written and re-arms itself the moment the
 * constant is a number again. Dragging between them is
 * how an action is added or taken off; dragging inside the first is how it is
 * ordered. Both directions are the same gesture, which is the point — a menu to
 * add and a drag to reorder made the same list behave two different ways.
 *
 * It lives in Settings rather than on the card because that is where the rest of
 * this account's preferences are, and because every row on the card is a link or
 * a button: an editor sharing those rows means drag and click fighting over the
 * same pointer.
 *
 * Three things about the mechanics:
 *
 * - **Every drag has a click equivalent** — `+` adds, `×` removes. Cross-zone
 *   keyboard dragging does work (both zones sit in one `DndContext`), but a
 *   feature whose only operation is a drag is a feature some people cannot use,
 *   and these two buttons cost nothing.
 * - **Zones are droppable in their own right**, not just their rows, or an empty
 *   zone would be impossible to drop into — which is exactly the state you are in
 *   when you have removed everything.
 * - **The cap refuses rather than truncates.** A sixth action is bounced with the
 *   reason said out loud; silently dropping it would look like a broken drag.
 *
 * The selection is the same account preference every other row on this page
 * writes (`quickActions`), so it saves itself: cache, debounced PATCH, other tabs
 * notified. See `helpers/quickActions.js` for the three states the cache can hold
 * and why an empty selection needs a sentinel.
 */

const CHOSEN = 'chosen';
const AVAILABLE = 'available';
const ZONE_ID = { [CHOSEN]: 'zone:chosen', [AVAILABLE]: 'zone:available' };

/**
 * Pointer first, geometry second.
 *
 * With two zones, distance-based detection answers with the zone the tile is
 * still *in* rather than the one it is being dropped *on* — the tile's own
 * container surrounds it, so it is always a close match. That made a drag from
 * Available into the dashboard list land on nothing at all: no error, no move,
 * just a tile springing back. The pointer is unambiguous — it is inside exactly
 * one zone — so it decides whenever there is one.
 *
 * The fallback is not optional: a keyboard drag has no pointer, so
 * `pointerWithin` returns nothing and geometry has to answer.
 */
const isZone = (id) => id === ZONE_ID[CHOSEN] || id === ZONE_ID[AVAILABLE];

const collisionDetection = (args) => {
  const byPointer = pointerWithin(args);

  // A tile beats the zone it sits in. Both contain the pointer, and `pointerWithin`
  // ranks them by distance to centre — so in a tall zone the *zone* often wins,
  // and then a drop reports the container instead of the tile under the cursor.
  // Reordering broke exactly there: every drag inside the dashboard list came back
  // as "dropped on the zone", which appends, so a tile dragged upwards jumped to
  // the bottom.
  const onTile = byPointer.filter((collision) => !isZone(collision.id));
  if (onTile.length > 0) return onTile;

  // Pointer inside a zone but not over any tile — empty space below the list, and
  // the only way to drop into an empty zone.
  if (byPointer.length > 0) return byPointer;

  // No pointer at all: a keyboard drag. Geometry has to answer.
  return closestCorners(args);
};

function ActionTile({ action, zone, isDragging, reducedMotion, onAdd, onRemove, dragHandle }) {
  const inChosen = zone === CHOSEN;

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-[var(--r-tile)] border bg-card px-2 py-1.5',
        inChosen ? 'border-separator' : 'border-dashed border-border',
        isDragging && 'border-primary/40 bg-primary/[0.06] shadow-elevated-sm'
      )}
      data-test={`settings-quick-action-${zone}-${action.key}`}
    >
      {dragHandle}

      <span
        className={cn(
          'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--r-control)]',
          inChosen ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
        )}
      >
        <action.icon className="h-3.5 w-3.5" />
      </span>

      <span
        className={cn(
          'min-w-0 flex-1 truncate text-[12.5px] font-medium',
          inChosen ? 'text-foreground' : 'text-muted-foreground'
        )}
      >
        {action.label}
      </span>

      {inChosen ? (
        <button
          type="button"
          onClick={() => onRemove(action.key)}
          aria-label={`Take ${action.label} off the dashboard`}
          className="rounded-[var(--r-control)] p-1 text-muted-foreground transition-colors hover:bg-[hsl(var(--tone-danger)/0.15)] hover:text-[hsl(var(--tone-danger-fg))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          data-test={`settings-quick-action-remove-${action.key}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onAdd(action.key)}
          aria-label={`Add ${action.label} to the dashboard`}
          className="rounded-[var(--r-control)] p-1 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          data-test={`settings-quick-action-add-${action.key}`}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function SortableActionTile({ action, zone, index, total, reducedMotion, onAdd, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: action.key,
    data: { zone },
    // `motion: reduced` is a stored account preference — the tile that slides out
    // of the way has to read it rather than animating regardless.
    ...(reducedMotion ? { transition: null } : {}),
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const handle = (
    <button
      type="button"
      className="cursor-grab touch-none rounded-[var(--r-control)] p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      // The action's own name and where it sits, not "Drag to reorder": a column
      // of identical handles tells a screen reader nothing about which has focus.
      aria-label={
        zone === CHOSEN
          ? `Move ${action.label} — position ${index + 1} of ${total} on the dashboard`
          : `Move ${action.label} onto the dashboard`
      }
      data-test={`settings-quick-action-grip-${action.key}`}
      {...attributes}
      {...listeners}
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );

  return (
    <div ref={setNodeRef} style={style}>
      <ActionTile
        action={action}
        zone={zone}
        isDragging={isDragging}
        reducedMotion={reducedMotion}
        onAdd={onAdd}
        onRemove={onRemove}
        dragHandle={handle}
      />
    </div>
  );
}

/**
 * A zone is a droppable of its own, so an empty one still accepts a drop and a
 * drag anywhere inside it lands, not only exactly over a tile.
 */
function Zone({ zone, title, count, hint, isOver, full, children }) {
  const { setNodeRef } = useDroppable({ id: ZONE_ID[zone], data: { zone } });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex min-h-[9rem] flex-col gap-2 rounded-[var(--r-tile)] border border-separator bg-muted/30 p-2.5 transition-colors',
        isOver && 'border-primary/50 bg-primary/[0.04]',
        isOver && full && 'border-[hsl(var(--tone-danger)/0.5)] bg-[hsl(var(--tone-danger)/0.06)]'
      )}
      data-test={`settings-quick-actions-zone-${zone}`}
    >
      <div className="flex items-baseline justify-between gap-2 px-0.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          {title}
        </span>
        {count}
      </div>

      <div className="flex-1 space-y-1.5">{children}</div>

      {hint ? <p className="px-0.5 text-[11px] leading-4 text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export default function QuickActionsRows({ role }) {
  const { motion } = useThemeConfig();
  const reducedMotion = motion === 'reduced';

  const [cached, setCached] = useStoredPreference(
    QUICK_ACTIONS_STORAGE_KEY,
    '',
    isValidQuickActionOrder
  );

  const selection = decodeQuickActionSelection(cached);
  const chosen = useMemo(() => resolveQuickActions(selection, role), [cached, role]);
  const available = useMemo(() => availableQuickActions(selection, role), [cached, role]);
  const byKey = useMemo(
    () => new Map(quickActionsForRole(role).map((action) => [action.key, action])),
    [role]
  );

  const [dragging, setDragging] = useState(null);
  const [overZone, setOverZone] = useState(null);

  const sensors = useSensors(
    // 6px, so a click on `+` or `×` is never read as the start of a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // `QUICK_ACTIONS_MAX` is currently `null` — no limit — so nothing is ever full
  // and the zone shows a plain count. The moment a number goes back in the
  // constant, the refusal, the hint and the "n / max" counter come back with it.
  const full = QUICK_ACTIONS_MAX !== null && chosen.length >= QUICK_ACTIONS_MAX;

  // Every write sends the whole list. A partial one would leave the rest to be
  // filled in from the default, and "the default" is the thing being edited.
  const save = (keys) => setCached(encodeQuickActionSelection(keys));

  const refuseCap = () =>
    toast.info(`The dashboard card holds ${QUICK_ACTIONS_MAX} actions.`, {
      description: 'Take one off first, then add this one.',
    });

  const addAt = (key, index) => {
    if (chosen.some((action) => action.key === key)) return;
    if (full) {
      refuseCap();
      return;
    }
    const keys = chosen.map((action) => action.key);
    const at = index === undefined || index < 0 ? keys.length : index;
    save([...keys.slice(0, at), key, ...keys.slice(at)]);
  };

  const remove = (key) => save(chosen.filter((action) => action.key !== key).map((a) => a.key));

  const zoneOf = (id) => {
    if (id === ZONE_ID[CHOSEN]) return CHOSEN;
    if (id === ZONE_ID[AVAILABLE]) return AVAILABLE;
    if (chosen.some((action) => action.key === id)) return CHOSEN;
    if (available.some((action) => action.key === id)) return AVAILABLE;
    return null;
  };

  const handleDragEnd = ({ active, over }) => {
    setDragging(null);
    setOverZone(null);
    if (!over) return;

    const from = zoneOf(active.id);
    const to = zoneOf(over.id);
    if (!from || !to) return;

    if (from === CHOSEN && to === CHOSEN) {
      const keys = chosen.map((action) => action.key);
      const oldIndex = keys.indexOf(active.id);
      const newIndex = over.id === ZONE_ID[CHOSEN] ? keys.length - 1 : keys.indexOf(over.id);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
      save(arrayMove(keys, oldIndex, newIndex));
      return;
    }

    if (from === AVAILABLE && to === CHOSEN) {
      // Dropped on a tile → take its place; dropped on the zone → the end.
      const index =
        over.id === ZONE_ID[CHOSEN]
          ? undefined
          : chosen.findIndex((action) => action.key === over.id);
      addAt(active.id, index);
      return;
    }

    if (from === CHOSEN && to === AVAILABLE) remove(active.id);
  };

  const draggingAction = dragging ? byKey.get(dragging) : null;

  return (
    <>
      <SettingsRow
        label="Dashboard quick actions"
        hint={
          QUICK_ACTIONS_MAX
            ? `Drag between the two lists to choose up to ${QUICK_ACTIONS_MAX}, and drag inside the first to order them. They follow your account, not this browser.`
            : 'Drag between the two lists to choose which actions the card shows, and drag inside the first to order them. They follow your account, not this browser.'
        }
      >
        {/* Only when there is something to undo. Reset writes the empty string,
            which the preference table maps to `null` and the server turns into a
            `$unset` — so the card goes back to whatever ships, rather than being
            pinned to today's default forever. */}
        {selection !== null ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCached('')}
            data-test="settings-quick-actions-reset"
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Reset
          </Button>
        ) : (
          <span className="text-[12px] text-muted-foreground">Standard set</span>
        )}
      </SettingsRow>

      <div className="py-[13px]">
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={({ active }) => setDragging(active.id)}
          onDragOver={({ over }) => setOverZone(over ? zoneOf(over.id) : null)}
          onDragCancel={() => {
            setDragging(null);
            setOverZone(null);
          }}
          onDragEnd={handleDragEnd}
        >
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Zone
              zone={CHOSEN}
              title="On your dashboard"
              isOver={overZone === CHOSEN}
              full={full && zoneOf(dragging) === AVAILABLE}
              count={
                <span
                  className={cn(
                    'text-[11px] font-semibold tabular-nums',
                    full ? 'text-muted-foreground' : 'text-primary'
                  )}
                >
                  {QUICK_ACTIONS_MAX ? `${chosen.length} / ${QUICK_ACTIONS_MAX}` : chosen.length}
                </span>
              }
              hint={
                full
                  ? 'Full — take one off to make room.'
                  : 'Top of this list is the top of the card.'
              }
            >
              <SortableContext
                items={chosen.map((action) => action.key)}
                strategy={verticalListSortingStrategy}
              >
                {chosen.map((action, index) => (
                  <SortableActionTile
                    key={action.key}
                    action={action}
                    zone={CHOSEN}
                    index={index}
                    total={chosen.length}
                    reducedMotion={reducedMotion}
                    onAdd={addAt}
                    onRemove={remove}
                  />
                ))}
              </SortableContext>

              {chosen.length === 0 && (
                <p className="rounded-[var(--r-tile)] border border-dashed border-border px-3 py-6 text-center text-[12px] leading-4 text-muted-foreground">
                  Nothing here — the card will say so on your dashboard. Drag an action across, or
                  Reset for the standard set.
                </p>
              )}
            </Zone>

            <Zone
              zone={AVAILABLE}
              title="Available"
              isOver={overZone === AVAILABLE}
              count={
                <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
                  {available.length}
                </span>
              }
              hint="Everything else your role can reach from the sidebar."
            >
              <SortableContext
                items={available.map((action) => action.key)}
                strategy={verticalListSortingStrategy}
              >
                {available.map((action, index) => (
                  <SortableActionTile
                    key={action.key}
                    action={action}
                    zone={AVAILABLE}
                    index={index}
                    total={available.length}
                    reducedMotion={reducedMotion}
                    onAdd={addAt}
                    onRemove={remove}
                  />
                ))}
              </SortableContext>

              {available.length === 0 && (
                <p className="rounded-[var(--r-tile)] border border-dashed border-border px-3 py-6 text-center text-[12px] leading-4 text-muted-foreground">
                  Every action your role has is already on the card.
                </p>
              )}
            </Zone>
          </div>

          {/* The tile follows the pointer between two columns, so the thing being
              dragged stays legible instead of being a gap in one list and a
              highlight in the other. */}
          <DragOverlay dropAnimation={reducedMotion ? null : undefined}>
            {draggingAction ? (
              <div className="w-64 max-w-full opacity-95">
                <ActionTile
                  action={draggingAction}
                  zone={zoneOf(dragging) || AVAILABLE}
                  isDragging
                  reducedMotion={reducedMotion}
                  onAdd={() => {}}
                  onRemove={() => {}}
                  dragHandle={
                    <span className="p-0.5 text-muted-foreground">
                      <GripVertical className="h-4 w-4" />
                    </span>
                  }
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </>
  );
}
