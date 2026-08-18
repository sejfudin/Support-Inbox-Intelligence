import { BOARD_SORT_OPTIONS } from '@/helpers/boardCardSort';
import { cn } from '@/lib/utils';

/**
 * "Sort cards · Priority Points Due Newest" — the board's card order, as the
 * segmented control the mockup puts on the tab bar beside Filter.
 */
export default function BoardSortControl({ value, onChange, dataTestPrefix = 'tickets' }) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <span className="hidden text-[11.5px] text-muted-foreground/75 lg:inline">Sort cards</span>
      <div
        className="flex items-center gap-0.5 rounded-[var(--r-control)] bg-muted p-0.5"
        role="radiogroup"
        aria-label="Sort cards in every column"
      >
        {BOARD_SORT_OPTIONS.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(option.value)}
              data-test={`${dataTestPrefix}-board-sort-${option.value}`}
              className={cn(
                'h-[26px] rounded-[var(--r-badge)] px-2 text-[11.5px] font-medium transition-colors',
                active
                  ? 'bg-card text-foreground shadow-elevated-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
