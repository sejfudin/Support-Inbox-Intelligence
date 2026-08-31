import { Archive, ChevronDown, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

/**
 * What a selection of tickets can be done with: move them all to one status, or
 * archive them all.
 *
 * One bar for both surfaces, in two shapes:
 * - inside a board column, under its cards, where the column header already says
 *   how many are selected and offers the way out (`showCount` / `onClear` off);
 * - above the ticket list, where the bar is the only thing that says a selection
 *   exists, so it carries the count and the Clear.
 *
 * `currentStatusId` drops one status from the menu — the column's own, which is
 * not a destination. The list passes nothing: its rows can be in any status, so
 * every status is a real move for some of them (the server skips the rest).
 */
export default function TicketBulkActionsBar({
  count,
  statusOptions = [],
  currentStatusId = null,
  onMove,
  onArchive,
  onClear,
  isPending = false,
  showCount = false,
  idPrefix,
  className,
}) {
  const moveTargets = currentStatusId
    ? statusOptions.filter((option) => option.value !== currentStatusId)
    : statusOptions;

  return (
    <div
      className={cn('flex flex-wrap items-center gap-1.5', className)}
      data-test={`${idPrefix}-selection-actions`}
    >
      {showCount ? (
        <span className="mr-1 text-[12.5px] font-semibold text-foreground" aria-live="polite">
          {count} selected
        </span>
      ) : null}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="secondary"
            size="sm"
            type="button"
            disabled={isPending || moveTargets.length === 0}
            data-test={`${idPrefix}-move-trigger`}
          >
            Move to
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          {moveTargets.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onSelect={() => onMove?.(option.value)}
              data-test={`${idPrefix}-move-to-${option.value}`}
            >
              <span
                className="mr-2 h-2 w-2 shrink-0 rounded-full"
                style={{ background: option.color }}
                aria-hidden
              />
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="outline"
        size="sm"
        type="button"
        disabled={isPending}
        onClick={() => onArchive?.()}
        data-test={`${idPrefix}-archive-button`}
      >
        <Archive className="h-3.5 w-3.5" />
        Archive
      </Button>

      {onClear ? (
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={onClear}
          data-test={`${idPrefix}-clear-selection-button`}
        >
          Clear
        </Button>
      ) : null}

      {isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-hidden />
      ) : null}
    </div>
  );
}
