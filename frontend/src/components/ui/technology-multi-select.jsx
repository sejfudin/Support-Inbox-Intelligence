import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronsUpDown, Plus, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TechnologyIcon } from '@/helpers/technologyIcons';

const DEFAULT_TRIGGER_CLASS =
  'flex h-11 w-full items-center justify-between rounded-[var(--r-card)] border border-input/90 bg-card px-3.5 py-2 text-left text-base text-muted-foreground shadow-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 md:text-sm';

const DEFAULT_CHIP_CLASS =
  'inline-flex items-center rounded-full bg-secondary px-3 py-[5px] text-xs font-medium text-secondary-foreground';

// How many chips render before collapsing behind a "+N more" toggle.
const VIEW_CHIP_LIMIT = 8;
const EDIT_CHIP_LIMIT = 4;

/**
 * The picked chips, on their own. Split out so a caller whose trigger sits in a
 * narrow column (the request form's position rows) can render them somewhere
 * with room — full width under the row — instead of wrapping them three-per-
 * line inside the column. Pair it with `showSelected={false}` on the picker so
 * they aren't drawn twice, and hand both the same `selectedIds`/`onChange`.
 */
export function SelectedTechnologyChips({
  technologies,
  selectedIds,
  onChange,
  chipClassName = DEFAULT_CHIP_CLASS,
  className,
}) {
  const selected = technologies.filter((technology) => selectedIds.includes(technology._id));
  if (selected.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {selected.map((technology) => (
        <RemovableChip
          key={technology._id}
          technology={technology}
          onRemove={() => onChange(selectedIds.filter((id) => id !== technology._id))}
          chipClassName={chipClassName}
        />
      ))}
    </div>
  );
}

function RemovableChip({ technology, onRemove, chipClassName }) {
  return (
    <span className={cn(chipClassName, 'gap-1.5')}>
      <TechnologyIcon technology={technology} size={13} className="shrink-0" />
      {technology.name}
      <button
        type="button"
        onClick={onRemove}
        className="text-muted-foreground transition hover:text-foreground"
        aria-label={`Remove ${technology.name}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

/**
 * Searchable technology multi-select. Intentionally an INLINE dropdown (not a
 * Radix Popover): when this picker lives inside a Radix Dialog, Radix's dialog
 * scroll-lock swallows wheel/touch scroll inside a portaled popover, so the
 * option list wouldn't scroll. Rendering the list in the consumer's own DOM
 * flow keeps native overflow scrolling working.
 *
 * Variants:
 * - "select" (default): input-like trigger with the selected chips wrapping
 *   below it.
 * - "box": bordered container holding the removable chips (collapsed behind
 *   "+N more" past 4) and an accent "+ Add technology".
 *
 * `triggerClassName`/`chipClassName` let callers match their own design
 * system (e.g. the recommendations redesign's hardcoded tokens) — defaults
 * fall back to the app's shadcn theme tokens.
 */
export function TechnologyMultiSelect({
  technologies,
  selectedIds,
  onChange,
  variant = 'select',
  placeholder = 'Select technologies…',
  triggerClassName = DEFAULT_TRIGGER_CLASS,
  chipClassName = DEFAULT_CHIP_CLASS,
  // "select" only: leave the chips to the caller (see SelectedTechnologyChips).
  showSelected = true,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef(null);

  const selectedTechnologies = useMemo(
    () => technologies.filter((technology) => selectedIds.includes(technology._id)),
    [selectedIds, technologies]
  );

  // Picked technologies stay in the list (checked) instead of disappearing —
  // removing a row shifts every row below it, which throws off your scroll
  // position after each pick in a long list. Search still narrows the list;
  // only that should move rows around.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return technologies;
    return technologies.filter((technology) => technology.name.toLowerCase().includes(q));
  }, [query, technologies]);

  const remove = (technologyId) => onChange(selectedIds.filter((id) => id !== technologyId));
  const toggle = (technologyId) => {
    if (selectedIds.includes(technologyId)) remove(technologyId);
    else onChange([...selectedIds, technologyId]);
  };

  const handleQueryChange = (value) => {
    setQuery(value);
    setHighlightedIndex(0);
  };

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        // Swallow the event so it only closes the dropdown — a surrounding
        // Radix Dialog (if any) also listens for Escape (capture, on
        // document) and would otherwise close the whole form, losing
        // everything typed. window-capture runs before document-capture, so
        // this wins.
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open]);

  // The trigger opens the dropdown below itself, but a trigger sitting near
  // the bottom of a scrollable dialog can leave it clipped/barely visible.
  // Scroll it into view (within whatever ancestor actually scrolls) once,
  // when it opens — not a bare inline function passed as `ref`, which React
  // treats as a new ref identity every render and re-fires on each keystroke
  // or selection, fighting the list's own scroll position.
  const dropdownRef = useRef(null);
  useEffect(() => {
    if (open) dropdownRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [open]);

  const handleSearchKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((prev) => (filtered.length ? (prev + 1) % filtered.length : 0));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((prev) =>
        filtered.length ? (prev - 1 + filtered.length) % filtered.length : 0
      );
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const technology = filtered[highlightedIndex];
      if (technology) toggle(technology._id);
    }
  };

  const dropdown = open && (
    <div
      ref={dropdownRef}
      className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-[var(--r-card)] border border-border bg-popover shadow-lg"
    >
      <div className="flex items-center gap-2 border-b border-border px-3">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
        <input
          autoFocus
          value={query}
          onChange={(event) => handleQueryChange(event.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder="Search technologies…"
          className="h-10 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          data-test="technology-multi-select-search"
        />
      </div>
      <div className="max-h-[240px] overflow-y-auto overscroll-contain p-1">
        {filtered.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            No technologies found.
          </p>
        )}
        {filtered.map((technology, index) => {
          const isSelected = selectedIds.includes(technology._id);
          return (
            <button
              key={technology._id}
              type="button"
              onClick={() => toggle(technology._id)}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-[var(--r-control)] px-2.5 py-2 text-left text-sm text-foreground transition',
                index === highlightedIndex ? 'bg-secondary' : 'hover:bg-secondary'
              )}
              data-test={`technology-multi-select-option-${technology.slug}`}
            >
              <TechnologyIcon technology={technology} size={16} className="shrink-0" />
              <span className="flex-1 truncate">{technology.name}</span>
              {isSelected ? (
                <Check className="h-4 w-4 shrink-0 text-primary" />
              ) : (
                <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  if (variant === 'box') {
    const visible = expanded
      ? selectedTechnologies
      : selectedTechnologies.slice(0, EDIT_CHIP_LIMIT);
    const hiddenCount = selectedTechnologies.length - visible.length;
    return (
      <div ref={containerRef} className="relative">
        <div className="rounded-[var(--r-card)] border border-input/90 px-3.5 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {visible.map((technology) => (
              <RemovableChip
                key={technology._id}
                technology={technology}
                onRemove={() => remove(technology._id)}
                chipClassName={chipClassName}
              />
            ))}
            {hiddenCount > 0 && (
              <button type="button" onClick={() => setExpanded(true)} className={chipClassName}>
                +{hiddenCount} more
              </button>
            )}
            {selectedTechnologies.length === 0 && (
              <span className="text-sm text-muted-foreground">No technologies selected.</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            className="mt-2.5 inline-flex items-center gap-1 text-sm font-semibold text-primary transition hover:opacity-80"
            data-test="technology-multi-select-trigger"
          >
            <Plus className="h-3.5 w-3.5" />
            Add technology
          </button>
        </div>
        {dropdown}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={triggerClassName}
        data-test="technology-multi-select-trigger"
      >
        {placeholder}
        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-60" />
      </button>
      {dropdown}
      {showSelected && selectedTechnologies.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {selectedTechnologies.map((technology) => (
            <RemovableChip
              key={technology._id}
              technology={technology}
              onRemove={() => remove(technology._id)}
              chipClassName={chipClassName}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Read-only chips list, collapsed behind "+N more" past 8. */
export function TechnologyViewChips({ technologies, chipClassName = DEFAULT_CHIP_CLASS }) {
  const [expanded, setExpanded] = useState(false);
  if (!technologies.length) {
    return <span className="text-sm text-muted-foreground">None selected.</span>;
  }
  const visible = expanded ? technologies : technologies.slice(0, VIEW_CHIP_LIMIT);
  const hiddenCount = technologies.length - visible.length;
  return (
    <div className="flex flex-wrap gap-2">
      {visible.map((technology) => (
        <span key={technology._id} className={cn(chipClassName, 'gap-1.5')}>
          <TechnologyIcon technology={technology} size={13} className="shrink-0" />
          {technology.name}
        </span>
      ))}
      {hiddenCount > 0 && (
        <button type="button" onClick={() => setExpanded(true)} className={chipClassName}>
          +{hiddenCount} more
        </button>
      )}
    </div>
  );
}
