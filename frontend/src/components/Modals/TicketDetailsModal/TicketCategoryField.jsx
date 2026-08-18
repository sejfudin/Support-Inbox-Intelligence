import { cn } from '@/lib/utils';
import { CHIP } from '@/helpers/badgeTones';

/**
 * Category chips. The selected one fills with a tint of its own colour and drops
 * its border; the rest are outlined in the hairline. A workspace picks these
 * colours itself, so they arrive as data and go through `style` — the geometry
 * is the shared chip's, which is what stops them drifting from every other badge
 * in the rail.
 */
const CHIP_BASE = cn(CHIP, 'cursor-pointer transition-colors');

const IDLE = 'border border-separator text-muted-foreground hover:text-foreground';

export function TicketCategoryField({ isArchived, categories, currentCategory, onCategoryChange }) {
  if (isArchived) {
    const selected = categories.find((c) => String(c._id) === String(currentCategory));
    if (!selected) return <span className="text-[12.5px] text-muted-foreground/75">None</span>;

    return (
      <span
        className={cn(CHIP_BASE, 'border border-transparent')}
        style={{ color: selected.color, backgroundColor: `${selected.color}1f` }}
      >
        {selected.name}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={() => onCategoryChange(null)}
        data-test="ticket-modal-category-option-none"
        className={cn(
          CHIP_BASE,
          currentCategory === null
            ? 'border border-transparent bg-foreground text-background'
            : IDLE
        )}
      >
        None
      </button>
      {categories.map((cat) => {
        const active = currentCategory === cat._id;
        return (
          <button
            key={cat._id}
            type="button"
            onClick={() => onCategoryChange(cat._id)}
            data-test={`ticket-modal-category-option-${cat._id}`}
            className={cn(CHIP_BASE, active ? 'border border-transparent' : IDLE)}
            style={active ? { color: cat.color, backgroundColor: `${cat.color}1f` } : undefined}
          >
            {cat.name}
          </button>
        );
      })}
    </div>
  );
}
