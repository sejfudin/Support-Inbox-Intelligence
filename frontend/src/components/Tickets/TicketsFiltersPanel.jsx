import { Button } from "@/components/ui/button";
import { ArrowUpDown, ChevronDown, Filter, X } from "lucide-react";
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
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  PRIORITY_FILTER_OPTIONS as DEFAULT_PRIORITY_OPTIONS,
  PRIORITY_FILTER_VALUES,
  ASSIGNEE_FILTER_VALUES,
  PRIORITY_ORDER_OPTIONS,
  PRIORITY_ORDER_VALUES,
  DUE_DATE_ORDER_OPTIONS as DEFAULT_DUE_DATE_ORDER_OPTIONS,
  DUE_DATE_ORDER_VALUES,
} from "@/helpers/ticketFilters";
import { PRIORITY_CONFIG } from "@/helpers/ticketPriority";

const getPriorityVisual = (value) => {
  const normalized = String(value || PRIORITY_FILTER_VALUES.ALL).toLowerCase();
  const config = PRIORITY_CONFIG[normalized];

  return normalized === PRIORITY_FILTER_VALUES.ALL
    ? { dot: "bg-slate-400" }
    : config
      ? { dot: config.dot }
      : { dot: "bg-slate-400" };
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

  activeFilterChips = [],
  onRemoveFilterChip,
  onClearAllFilters,
  className,
}) {
  const activeFilterCount = selectedPriorities.length + selectedAssigneeIds.length;
  const activeSortCount =
    (priorityOrder !== PRIORITY_ORDER_VALUES.NONE ? 1 : 0) +
    (dueDateOrder !== DUE_DATE_ORDER_VALUES.DEFAULT ? 1 : 0);
  const hasActiveSelections = activeFilterCount > 0 || activeSortCount > 0;
  const hasActiveChips = activeFilterChips.length > 0;
  const CONTROL_BUTTON_CLASS = "rounded-xl px-4 justify-between gap-2";

  return (
    <div className={cn("flex w-full flex-col gap-2 md:w-auto md:items-start", className)}>
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-start">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className={cn("w-full sm:w-auto", CONTROL_BUTTON_CLASS)}>
              <span className="inline-flex items-center gap-2">
                <Filter className="h-4 w-4" />
                <span>Filter</span>
                {activeFilterCount > 0 ? (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                    {activeFilterCount}
                  </span>
                ) : null}
              </span>
              <ChevronDown className="h-4 w-4 opacity-70" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel>Filter tickets</DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Priority</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-56">
                <DropdownMenuCheckboxItem
                  checked={selectedPriorities.length === 0}
                  onCheckedChange={() => onTogglePriority?.(PRIORITY_FILTER_VALUES.ALL)}
                  onSelect={(e) => e.preventDefault()}
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
                      >
                        <span className="flex items-center gap-2">
                          <span className={cn("h-2 w-2 rounded-full", visual.dot)} />
                          <span>{option.label}</span>
                        </span>
                      </DropdownMenuCheckboxItem>
                    );
                  })}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Assigned To</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-64">
                <DropdownMenuCheckboxItem
                  checked={selectedAssigneeIds.length === 0}
                  onCheckedChange={() => onToggleAssignee?.(ASSIGNEE_FILTER_VALUES.ALL)}
                  onSelect={(e) => e.preventDefault()}
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
            <Button variant="outline" className={cn("w-full sm:w-auto", CONTROL_BUTTON_CLASS)}>
              <span className="inline-flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4" />
                <span>Sort</span>
                {activeSortCount > 0 ? (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                    {activeSortCount}
                  </span>
                ) : null}
              </span>
              <ChevronDown className="h-4 w-4 opacity-70" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel>Sort tickets</DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Priority</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-56">
                <DropdownMenuRadioGroup
                  value={priorityOrder}
                  onValueChange={(value) => onPriorityOrderChange?.(value)}
                >
                  {priorityOrderOptions.map((option) => (
                    <DropdownMenuRadioItem key={option.value} value={option.value}>
                      {option.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Due date</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-56">
                <DropdownMenuRadioGroup
                  value={dueDateOrder}
                  onValueChange={(value) => onDueDateOrderChange?.(value)}
                >
                  {dueDateOrderOptions.map((option) => (
                    <DropdownMenuRadioItem key={option.value} value={option.value}>
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
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs",
                chip.className || "border-border/80 bg-secondary/70 text-foreground",
              )}
            >
              {chip.dotClass ? <span className={cn("h-2 w-2 rounded-full", chip.dotClass)} /> : null}
              <span>{chip.label}</span>
              <button
                type="button"
                onClick={() => onRemoveFilterChip?.(chip.key)}
                className="rounded-full p-0.5 hover:bg-black/10"
                aria-label={`Remove ${chip.label}`}
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
            >
              Clear all
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
