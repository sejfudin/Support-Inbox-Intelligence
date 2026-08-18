import * as React from 'react';
import { Search, X } from 'lucide-react';

import { cn } from '@/lib/utils';

const WIDTHS = {
  default: 'w-[240px]',
  header: 'w-[320px]',
  block: 'w-full',
};

/**
 * The search field — one build for the whole app.
 *
 * There were three: a 36px pill in Tickets, a 40px field in the hero bands, and
 * a 32px one above the tables. They are all this now: 32px, radius 8, leading
 * icon, and a placeholder that ends in an ellipsis. The 36px and 40px versions
 * are retired; a search box is a toolbar control and takes the toolbar's height.
 *
 * The focus ring is on the wrapper, not the `<input>` — the border and the halo
 * belong to the bordered box, and putting them on the inner field draws a
 * rectangle inside a rectangle.
 *
 * @param {object} props
 * @param {string} props.value
 * @param {(value: string) => void} props.onChange   receives the string, not the event
 * @param {'default'|'header'|'block'} [props.width] 240 · 320 in a page header · full above a table
 * @param {boolean} [props.clearable]                shows a clear button once there is a query
 */
const SearchField = React.forwardRef(
  (
    {
      value = '',
      onChange,
      placeholder = 'Search…',
      width = 'default',
      clearable = true,
      className,
      inputClassName,
      ...props
    },
    ref
  ) => (
    <div
      className={cn(
        'ui-focus-ring-within flex h-[var(--h-md)] items-center gap-2 rounded-[var(--r-control)] border border-border bg-card px-[var(--px-md)] transition-colors',
        WIDTHS[width] ?? WIDTHS.default,
        className
      )}
    >
      <Search
        className="h-[14px] w-[14px] shrink-0 text-muted-foreground/75"
        strokeWidth={1.8}
        aria-hidden
      />
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        className={cn(
          // `appearance-none` kills WebKit's own clear button, which would
          // otherwise sit next to ours at a different size.
          'min-w-0 flex-1 appearance-none border-0 bg-transparent p-0 text-[length:var(--fs-control)] text-foreground outline-none placeholder:text-muted-foreground/75 [&::-webkit-search-cancel-button]:appearance-none',
          inputClassName
        )}
        {...props}
      />
      {clearable && value ? (
        <button
          type="button"
          onClick={() => onChange?.('')}
          aria-label="Clear search"
          className="ui-focus-ring -mr-1 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[var(--r-badge)] text-muted-foreground/75 transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="h-3 w-3" strokeWidth={2} aria-hidden />
        </button>
      ) : null}
    </div>
  )
);
SearchField.displayName = 'SearchField';

export { SearchField };
