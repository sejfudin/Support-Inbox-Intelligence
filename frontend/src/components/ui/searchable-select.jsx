import { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';

function DropdownMessage({ children }) {
  return <div className="px-4 py-3 text-sm text-muted-foreground">{children}</div>;
}

/**
 * Search-as-you-type single-picker. Type into the input, a popover shows the
 * filtered items, click/keyboard-select one to fire `onSelect`. The input clears
 * after a pick — callers render the current selection themselves if they need to.
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
}) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const listRef = useRef(null);
  const debounceRef = useRef(null);

  const results = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return [];
    const match = filter || ((item, query) => getLabel(item).toLowerCase().includes(query));
    return items.filter((item) => match(item, q));
  }, [debouncedSearch, items, filter, getLabel]);

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
    if (!item) return;
    onSelect?.(item);
    reset();
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

  return (
    <Popover
      open={search.trim().length > 0}
      onOpenChange={(isOpen) => {
        if (!isOpen) reset();
      }}
    >
      <PopoverAnchor asChild>
        <div>
          <Input
            id={id}
            placeholder={placeholder}
            value={search}
            onChange={onSearchChange}
            onKeyDown={focusFirstRow}
            disabled={disabled}
            data-test={dataTest}
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="max-h-72 w-[var(--radix-popper-anchor-width)] overflow-y-auto rounded-xl border border-border bg-card p-0 shadow-md"
      >
        {isLoading && <DropdownMessage>{loadingMessage}</DropdownMessage>}
        {!isLoading && results.length === 0 && <DropdownMessage>{emptyMessage}</DropdownMessage>}
        {!isLoading && results.length > 0 && (
          <div ref={listRef} onClick={handleListClick} onKeyDown={handleListKeyDown}>
            {results.map((item) => {
              const key = getKey(item);
              return (
                <div
                  key={key}
                  role="button"
                  tabIndex={0}
                  data-item-key={String(key)}
                  data-test={getItemDataTest?.(item)}
                  className="cursor-pointer px-4 py-2.5 text-sm outline-none first:rounded-t-xl last:rounded-b-xl hover:bg-muted/50 focus:bg-muted/50"
                >
                  {renderItem ? (
                    renderItem(item)
                  ) : (
                    <span className="font-medium">{getLabel(item)}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
