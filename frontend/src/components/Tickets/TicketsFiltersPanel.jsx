import { Button } from '@/components/ui/button';
import { ArrowUpDown, ChevronDown, Filter, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  PRIORITY_FILTER_OPTIONS as DEFAULT_PRIORITY_OPTIONS,
  PRIORITY_FILTER_VALUES,
  ASSIGNEE_FILTER_VALUES,
  PRIORITY_ORDER_OPTIONS,
  PRIORITY_ORDER_VALUES,
  DUE_DATE_ORDER_OPTIONS as DEFAULT_DUE_DATE_ORDER_OPTIONS,
  DUE_DATE_ORDER_VALUES,
  TICKET_ID_ORDER_OPTIONS as DEFAULT_TICKET_ID_ORDER_OPTIONS,
  TICKET_ID_ORDER_VALUES,
} from '@/helpers/ticketFilters';
import { PRIORITY_CONFIG } from '@/helpers/ticketPriority';

const getPriorityVisual = (value) => {
  const normalized = String(value || PRIORITY_FILTER_VALUES.ALL).toLowerCase();
  const config = PRIORITY_CONFIG[normalized];

  return normalized === PRIORITY_FILTER_VALUES.ALL
    ? { dot: 'bg-muted-foreground' }
    : config
      ? { dot: config.dot }
      : { dot: 'bg-muted-foreground' };
};

export default function TicketFiltersPanel({
  selectedPriorities = [],
  onTogglePriority,
  priorityOptions = DEFAULT_PRIORITY_OPTIONS,

  selectedAssigneeIds = [],
  onToggleAssignee,
  assigneeOptions = [],

  priorityOrder = PRIORITY_ORDER_VALUES.NONE,
  onPriorityOrderChange,
  priorityOrderOptions = PRIORITY_ORDER_OPTIONS,

  dueDateOrder = DUE_DATE_ORDER_VALUES.DEFAULT,
  onDueDateOrderChange,
  dueDateOrderOptions = DEFAULT_DUE_DATE_ORDER_OPTIONS,

  ticketIdOrder = TICKET_ID_ORDER_VALUES.NONE,
  onTicketIdOrderChange,
  ticketIdOrderOptions = DEFAULT_TICKET_ID_ORDER_OPTIONS,

  activeFilterChips = [],
  onRemoveFilterChip,
  onClearAllFilters,
  className,
}) {
  const activeFilterCount = selectedPriorities.length + selectedAssigneeIds.length;
  const activeSortCount =
    (priorityOrder !== PRIORITY_ORDER_VALUES.NONE ? 1 : 0) +
    (dueDateOrder !== DUE_DATE_ORDER_VALUES.DEFAULT ? 1 : 0) +
    (ticketIdOrder !== TICKET_ID_ORDER_VALUES.NONE ? 1 : 0);
  const hasActiveSelections = activeFilterCount > 0 || activeSortCount > 0;
  const hasActiveChips = activeFilterChips.length > 0;
  // The mockup's band control: 32px tall, 11px side padding, 8px radius, a
  // hairline outline on a transparent fill. It was a 40px `rounded-[var(--r-card)]` button,
  // which stood taller than the 32px tab pills it shares the band with.
  const CONTROL_BUTTON_CLASS =
    'h-8 justify-between gap-[7px] rounded-[var(--r-control)] border-separator px-[11px] text-[12.5px] font-medium text-foreground';

  return (
    <div className={cn('flex w-full flex-col gap-2 md:w-auto md:items-start', className)}>
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-start">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className={cn('w-full sm:w-auto', CONTROL_BUTTON_CLASS)}
              data-test="tickets-filter-trigger"
            >
              <span className="inline-flex items-center gap-[7px]">
                <Filter className="h-3.5 w-3.5" />
                <span>Filter</span>
                {activeFilterCount > 0 ? (
                  <span className="rounded-full bg-primary/10 px-1.5 py-px text-[11px] font-semibold text-primary">
                    {activeFilterCount}
                  </span>
                ) : null}
              </span>
              <ChevronDown className="h-3.5 w-3.5 opacity-70" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel>Filter tickets</DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuSub>
              <DropdownMenuSubTrigger data-test="tickets-filter-priority-submenu-trigger">
                Priority
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-56">
                <DropdownMenuCheckboxItem
                  checked={selectedPriorities.length === 0}
                  onCheckedChange={() => onTogglePriority?.(PRIORITY_FILTER_VALUES.ALL)}
                  onSelect={(e) => e.preventDefault()}
                  data-test="tickets-filter-priority-option-all"
                >
                  All priorities
                </DropdownMenuCheckboxItem>

                {priorityOptions
                  .filter((option) => option.value !== PRIORITY_FILTER_VALUES.ALL)
                  .map((option) => {
                    const visual = getPriorityVisual(option.value);

                    return (
                      <DropdownMenuCheckboxItem
                        key={option.value}
                        checked={selectedPriorities.includes(option.value)}
                        onCheckedChange={() => onTogglePriority?.(option.value)}
                        onSelect={(e) => e.preventDefault()}
                        data-test={`tickets-filter-priority-option-${option.value}`}
                      >
                        <span className="flex items-center gap-2">
                          <span className={cn('h-2 w-2 rounded-full', visual.dot)} />
                          <span>{option.label}</span>
                        </span>
                      </DropdownMenuCheckboxItem>
                    );
                  })}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger data-test="tickets-filter-assignee-submenu-trigger">
                Assigned To
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-64">
                <DropdownMenuCheckboxItem
                  checked={selectedAssigneeIds.length === 0}
                  onCheckedChange={() => onToggleAssignee?.(ASSIGNEE_FILTER_VALUES.ALL)}
                  onSelect={(e) => e.preventDefault()}
                  data-test="tickets-filter-assignee-option-all"
                >
                  All assignees
                </DropdownMenuCheckboxItem>

                {assigneeOptions
                  .filter((option) => option.value !== ASSIGNEE_FILTER_VALUES.ALL)
                  .map((option) => (
                    <DropdownMenuCheckboxItem
                      key={option.value}
                      checked={selectedAssigneeIds.includes(option.value)}
                      onCheckedChange={() => onToggleAssignee?.(option.value)}
                      onSelect={(e) => e.preventDefault()}
                      data-test={`tickets-filter-assignee-option-${option.value}`}
                    >
                      <span className="truncate">{option.label}</span>
                    </DropdownMenuCheckboxItem>
                  ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className={cn('w-full sm:w-auto', CONTROL_BUTTON_CLASS)}
              data-test="tickets-filter-sort-trigger"
            >
              <span className="inline-flex items-center gap-[7px]">
                <ArrowUpDown className="h-3.5 w-3.5" />
                <span>Sort</span>
                {activeSortCount > 0 ? (
                  <span className="rounded-full bg-primary/10 px-1.5 py-px text-[11px] font-semibold text-primary">
                    {activeSortCount}
                  </span>
                ) : null}
              </span>
              <ChevronDown className="h-3.5 w-3.5 opacity-70" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel>Sort tickets</DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuSub>
              <DropdownMenuSubTrigger data-test="tickets-filter-sort-priority-submenu-trigger">
                Priority
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-56">
                <DropdownMenuRadioGroup
                  value={priorityOrder}
                  onValueChange={(value) => onPriorityOrderChange?.(value)}
                >
                  {priorityOrderOptions.map((option) => (
                    <DropdownMenuRadioItem
                      key={option.value}
                      value={option.value}
                      data-test={`tickets-filter-sort-priority-option-${option.value}`}
                    >
                      {option.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger data-test="tickets-filter-sort-due-date-submenu-trigger">
                Due date
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-56">
                <DropdownMenuRadioGroup
                  value={dueDateOrder}
                  onValueChange={(value) => onDueDateOrderChange?.(value)}
                >
                  {dueDateOrderOptions.map((option) => (
                    <DropdownMenuRadioItem
                      key={option.value}
                      value={option.value}
                      data-test={`tickets-filter-sort-due-date-option-${option.value}`}
                    >
                      {option.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger data-test="tickets-filter-sort-ticket-id-submenu-trigger">
                Ticket ID
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-56">
                <DropdownMenuRadioGroup
                  value={ticketIdOrder}
                  onValueChange={(value) => onTicketIdOrderChange?.(value)}
                >
                  {ticketIdOrderOptions.map((option) => (
                    <DropdownMenuRadioItem
                      key={option.value}
                      value={option.value}
                      data-test={`tickets-filter-sort-ticket-id-option-${option.value}`}
                    >
                      {option.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {hasActiveChips ? (
        <div className="flex w-full flex-wrap items-center gap-2">
          {activeFilterChips.map((chip) => (
            <span
              key={chip.key}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs',
                chip.className || 'border-border/80 bg-secondary/70 text-foreground'
              )}
            >
              {chip.dotClass ? (
                <span className={cn('h-2 w-2 rounded-full', chip.dotClass)} />
              ) : null}
              <span>{chip.label}</span>
              <button
                type="button"
                onClick={() => onRemoveFilterChip?.(chip.key)}
                className="rounded-full p-0.5 hover:bg-black/10"
                aria-label={`Remove ${chip.label}`}
                data-test={`tickets-filter-chip-remove-${chip.key}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}

          {hasActiveSelections ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClearAllFilters}
              className="h-7 px-2 text-xs"
              data-test="tickets-filter-clear-all-button"
            >
              Clear all
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
