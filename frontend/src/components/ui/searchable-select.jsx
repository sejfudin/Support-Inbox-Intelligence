import { useEffect, useMemo, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

function DropdownMessage({ children }) {
  return <div className="px-4 py-3 text-sm text-muted-foreground">{children}</div>;
}

/**
 * Search-as-you-type picker. Type into the input, a popover shows the filtered
 * items, click/keyboard-select one to fire `onSelect`. By default the input
 * clears and the popover closes after a pick — callers render the current
 * selection themselves if they need to. Pass `keepOpenOnSelect` for a caller
 * adding several items in a row.
 *
 * Extracted from the intern technology declaration flow so any "search a catalog
 * and pick an item" control shares the same behavior (debounce, keyboard nav, styling).
 *
 * @param {object[]} items            Full candidate list.
 * @param {(item) => void} onSelect   Called with the chosen item.
 * @param {(item) => string|number} getKey    Unique key per item (default `item._id`).
 * @param {(item) => string} getLabel          Display + default-filter text (default `item.name`).
 * @param {(item, query) => boolean} [filter]  Override matching (query is lowercased/trimmed).
 * @param {(item) => React.ReactNode} [renderItem]  Custom row content.
 * @param {(item) => string} [getItemDataTest]      Per-row `data-test`.
 * @param {boolean} [busy]            Blocks selection (e.g. a save in flight) but keeps the input usable.
 * @param {boolean} [disabled]        Fully disables the input.
 * @param {string} [inputClassName]   Extra classes on the input — for callers that
 *                                    need it at a non-default size, e.g. the 34px
 *                                    field in a flat card's header band.
 * @param {boolean} [keepOpenOnSelect] Stay open and keep the query after a pick, instead of
 *                                    clearing and closing — for callers adding several items
 *                                    in a row, where closing on every pick means re-typing the
 *                                    search to find the next one.
 * @param {(item) => boolean} [isSelected] Marks a row already picked: shown with a check,
 *                                    not clickable. Only meaningful with `keepOpenOnSelect`,
 *                                    where a picked item can still be in view.
 * @param {boolean} [openOnFocus]    Open on focus showing the full `items` list, narrowing
 *                                    as you type, instead of staying empty until the first
 *                                    keystroke — for a catalog worth browsing, not just
 *                                    searching.
 */
export function SearchableSelect({
  items = [],
  onSelect,
  getKey = (item) => item._id,
  getLabel = (item) => item.name,
  filter,
  renderItem,
  getItemDataTest,
  placeholder = 'Search...',
  emptyMessage = 'No results found.',
  loadingMessage = 'Searching...',
  busy = false,
  disabled = false,
  debounceMs = 300,
  id,
  dataTest,
  inputClassName,
  keepOpenOnSelect = false,
  isSelected,
  openOnFocus = false,
}) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const listRef = useRef(null);
  const debounceRef = useRef(null);
  const anchorRef = useRef(null);

  const results = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return openOnFocus ? items : [];
    const match = filter || ((item, query) => getLabel(item).toLowerCase().includes(query));
    return items.filter((item) => match(item, q));
  }, [debouncedSearch, items, filter, getLabel, openOnFocus]);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const reset = () => {
    setSearch('');
    setDebouncedSearch('');
  };

  // ArrowDown from the input hands focus to the first row.
  const focusFirstRow = (e) => {
    if (e.key !== 'ArrowDown') return;
    e.preventDefault();
    listRef.current?.querySelector('[role="button"]')?.focus();
  };

  const selectByKey = (key) => {
    if (busy) return;
    const item = results.find((r) => String(getKey(r)) === key);
    if (!item || isSelected?.(item)) return;
    onSelect?.(item);
    if (!keepOpenOnSelect) {
      reset();
      if (openOnFocus) setIsOpen(false);
    }
  };

  // Single delegated handler — resolves the item from the row's data-item-key
  // instead of each row carrying its own handlers.
  const handleListClick = (e) => {
    const row = e.target.closest('[data-item-key]');
    if (row) selectByKey(row.dataset.itemKey);
  };

  const handleListKeyDown = (e) => {
    const row = e.target.closest('[data-item-key]');
    if (!row) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      row.nextElementSibling?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      row.previousElementSibling?.focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectByKey(row.dataset.itemKey);
    }
  };

  const onSearchChange = (e) => {
    const value = e.target.value;
    setSearch(value);
    setIsLoading(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setIsLoading(false);
    }, debounceMs);
  };

  const popoverOpen = openOnFocus ? isOpen : search.trim().length > 0;

  return (
    <Popover
      open={popoverOpen}
      onOpenChange={(nextOpen) => {
        if (openOnFocus) setIsOpen(nextOpen);
        if (!nextOpen) reset();
      }}
    >
      <PopoverAnchor asChild>
        <div ref={anchorRef}>
          <Input
            id={id}
            className={inputClassName}
            placeholder={placeholder}
            value={search}
            onChange={onSearchChange}
            onKeyDown={focusFirstRow}
            onFocus={openOnFocus ? () => setIsOpen(true) : undefined}
            disabled={disabled}
            data-test={dataTest}
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
        // openOnFocus opens the content while the input still has focus (that's how
        // it opened). Radix's dismissable layer sees that focus/pointer activity on
        // the anchor at the instant Content mounts and reads it as "outside" —
        // without these guards it closes in the same tick it opens. A real outside
        // click still passes through (the anchor ref only covers the input itself).
        {...(openOnFocus && {
          onCloseAutoFocus: (e) => e.preventDefault(),
          onFocusOutside: (e) => {
            if (anchorRef.current?.contains(e.target)) e.preventDefault();
          },
          onPointerDownOutside: (e) => {
            if (anchorRef.current?.contains(e.target)) e.preventDefault();
          },
        })}
        className="max-h-72 w-[var(--radix-popper-anchor-width)] overflow-y-auto rounded-[var(--r-card)] border border-border bg-card p-0 shadow-md"
      >
        {isLoading && <DropdownMessage>{loadingMessage}</DropdownMessage>}
        {!isLoading && results.length === 0 && <DropdownMessage>{emptyMessage}</DropdownMessage>}
        {!isLoading && results.length > 0 && (
          <div ref={listRef} onClick={handleListClick} onKeyDown={handleListKeyDown}>
            {results.map((item) => {
              const key = getKey(item);
              const picked = isSelected?.(item);
              return (
                <div
                  key={key}
                  role="button"
                  tabIndex={picked ? -1 : 0}
                  aria-disabled={picked || undefined}
                  data-item-key={String(key)}
                  data-test={getItemDataTest?.(item)}
                  className={cn(
                    'flex items-center justify-between gap-2 px-4 py-2.5 text-sm outline-none first:rounded-t-xl last:rounded-b-xl',
                    picked
                      ? 'cursor-default text-muted-foreground'
                      : 'cursor-pointer hover:bg-muted/50 focus:bg-muted/50'
                  )}
                >
                  {renderItem ? (
                    renderItem(item)
                  ) : (
                    <span className="font-medium">{getLabel(item)}</span>
                  )}
                  {picked && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                </div>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
