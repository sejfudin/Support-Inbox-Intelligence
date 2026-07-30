import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

// Radix Select forbids an empty-string item value, so the "Default" (no sort)
// option uses this sentinel while callers keep tracking sortKey as ''.
export const SORT_DEFAULT = 'default';

/**
 * Shared sort control for the intern history sections (evaluations, notes,
 * recommendations): a "Sort: X" select plus an asc/desc direction toggle.
 * Fully controlled — callers own sortKey ('' = default order) and sortDir.
 *
 * @param {Object} props
 * @param {string} props.sortKey            '' for default order
 * @param {'asc'|'desc'} props.sortDir
 * @param {Array<{key:string,label:string}>} props.options
 * @param {(key:string) => void} props.onSortKeyChange
 * @param {() => void} props.onToggleDir
 * @param {string} [props.className]        container overrides (height, colors)
 * @param {string} [props.triggerClassName] select trigger text overrides
 * @param {string} [props.dataTest]
 */
export function SortControl({
  sortKey,
  sortDir,
  options,
  onSortKeyChange,
  onToggleDir,
  className,
  triggerClassName,
  dataTest,
}) {
  return (
    <div
      className={cn(
        'flex h-10 items-center rounded-xl border border-input bg-background transition focus-within:border-ring',
        className
      )}
    >
      <ArrowUpDown className="ml-3 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <Select
        value={sortKey || SORT_DEFAULT}
        onValueChange={(value) => onSortKeyChange(value === SORT_DEFAULT ? '' : value)}
      >
        <SelectTrigger
          className={cn(
            'h-full border-0 bg-transparent px-2 text-sm font-medium shadow-none focus:ring-0 focus:ring-offset-0',
            triggerClassName
          )}
          data-test={dataTest}
          aria-label="Sort by"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          <SelectItem value={SORT_DEFAULT}>Sort: Default</SelectItem>
          {options.map((opt) => (
            <SelectItem key={opt.key} value={opt.key}>
              Sort: {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <button
        type="button"
        disabled={!sortKey}
        onClick={onToggleDir}
        className="grid h-full w-9 place-items-center rounded-r-xl border-l border-input text-muted-foreground transition hover:text-foreground disabled:opacity-40 disabled:hover:text-muted-foreground"
        aria-label={`Sort direction: ${sortDir === 'asc' ? 'ascending' : 'descending'}`}
        title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
      >
        {sortDir === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
      </button>
    </div>
  );
}
