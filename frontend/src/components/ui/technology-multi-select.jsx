import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronsUpDown, Plus, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TechnologyIcon } from '@/helpers/technologyIcons';

const DEFAULT_TRIGGER_CLASS =
  'flex h-11 w-full items-center justify-between rounded-xl border border-input/90 bg-card px-3.5 py-2 text-left text-base text-muted-foreground shadow-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 md:text-sm';

const DEFAULT_CHIP_CLASS =
  'inline-flex items-center rounded-full bg-secondary px-3 py-[5px] text-xs font-medium text-secondary-foreground';

// How many chips render before collapsing behind a "+N more" toggle.
const VIEW_CHIP_LIMIT = 8;
const EDIT_CHIP_LIMIT = 4;

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

  // Only show technologies not already picked — selecting one removes it from
  // the pool; removal returns it to the pool.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return technologies.filter(
      (technology) =>
        !selectedIds.includes(technology._id) && (!q || technology.name.toLowerCase().includes(q))
    );
  }, [query, technologies, selectedIds]);

  const add = (technologyId) => {
    if (!selectedIds.includes(technologyId)) onChange([...selectedIds, technologyId]);
    // Picking an item shrinks the filtered pool — re-anchor at the top rather
    // than risk pointing past the new end of the list.
    setHighlightedIndex(0);
  };
  const remove = (technologyId) => onChange(selectedIds.filter((id) => id !== technologyId));

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
  // A callback ref fires as soon as the node mounts, so this scrolls it into
  // view (within whatever ancestor actually scrolls) without an effect.
  const scrollDropdownIntoView = (node) => {
    if (node) node.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

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
      if (technology) add(technology._id);
    }
  };

  const dropdown = open && (
    <div
      ref={scrollDropdownIntoView}
      className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lg"
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
            {selectedIds.length === technologies.length
              ? 'All technologies added.'
              : 'No technologies found.'}
          </p>
        )}
        {filtered.map((technology, index) => (
          <button
            key={technology._id}
            type="button"
            onClick={() => add(technology._id)}
            onMouseEnter={() => setHighlightedIndex(index)}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-left text-sm text-foreground transition',
              index === highlightedIndex ? 'bg-secondary' : 'hover:bg-secondary'
            )}
            data-test={`technology-multi-select-option-${technology.slug}`}
          >
            <TechnologyIcon technology={technology} size={16} className="shrink-0" />
            <span className="flex-1 truncate">{technology.name}</span>
            <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        ))}
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
        <div className="rounded-xl border border-input/90 px-3.5 py-3">
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
      {selectedTechnologies.length > 0 && (
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
