import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

// The library's filter dropdown: same 32px height and radius-8 shell as a
// `FilterChip`, because the two are siblings in a filter bar and only the caret
// should tell them apart. That is also why chips and dropdowns belong in
// separate rows — with nothing but a caret between them, mixing them in one row
// makes a toggle look like a menu.
//
// Every number is a token, so the row tightens with the density setting instead
// of standing at 32px while the buttons beside it shrink.
const FILTER_TRIGGER =
  'h-[var(--h-md)] w-auto gap-2 rounded-[var(--r-control)] border-border bg-card px-[var(--px-md)] text-[length:var(--fs-control)] font-medium shadow-none data-[state=open]:bg-accent [&>span]:line-clamp-1 [&>svg]:size-[13px] [&>svg]:text-muted-foreground/75';

/**
 * @param {{
 *   value: string,
 *   onChange: (value: string) => void,   // receives the raw value, 'all' included
 *   options: Array<{value: string, label: string}>,
 *   allLabel?: string,   // adds a leading "All …" option and uses it as the placeholder
 *   active?: boolean,    // defaults to "a value is set"; pass it when the resting state isn't empty
 *   dataTest?: string,
 *   className?: string,
 * }} props
 */
export default function FilterSelect({
  value,
  onChange,
  options,
  allLabel,
  active,
  dataTest,
  className,
}) {
  const isActive = active ?? Boolean(value);

  return (
    <Select value={value || 'all'} onValueChange={onChange}>
      <SelectTrigger
        // A set filter tints itself. The trigger shows the chosen value rather
        // than the field name, so without this there is nothing to tell "All
        // hubs" apart from a hub you actually picked.
        className={cn(
          FILTER_TRIGGER,
          isActive && 'accent-ink border-primary bg-primary/10 font-semibold',
          className
        )}
        data-test={dataTest}
      >
        <SelectValue placeholder={allLabel} />
      </SelectTrigger>
      <SelectContent>
        {allLabel && <SelectItem value="all">{allLabel}</SelectItem>}
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
