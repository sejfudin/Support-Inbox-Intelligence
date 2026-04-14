import { useMemo, useState } from "react";
import {
  ASSIGNEE_FILTER_VALUES,
  DEFAULT_TICKET_CONTROLS,
  PRIORITY_FILTER_OPTIONS,
  PRIORITY_FILTER_VALUES,
  PRIORITY_ORDER_OPTIONS,
  PRIORITY_ORDER_VALUES,
  buildTicketQueryParamsFromControls,
} from "@/helpers/ticketFilters";
import { PRIORITY_CONFIG } from "@/helpers/ticketPriority";

export function useTicketFiltersControls({ assigneeOptions = [] } = {}) {
  const [controls, setControls] = useState(() => ({ ...DEFAULT_TICKET_CONTROLS }));

  const queryFilters = useMemo(
    () => buildTicketQueryParamsFromControls(controls),
    [controls],
  );

  const activeFilterChips = useMemo(() => {
    const chips = [];

    controls.priorities.forEach((priorityValue) => {
      const selectedPriority = PRIORITY_FILTER_OPTIONS.find(
        (option) => option.value === priorityValue,
      );
      const visual = PRIORITY_CONFIG[priorityValue];

      chips.push({
        key: `priority:${priorityValue}`,
        label: `Priority: ${selectedPriority?.label || priorityValue}`,
        className: visual
          ? `border-transparent ${visual.badge}`
          : "border-border/80 bg-secondary/70 text-foreground",
        dotClass: visual?.dot,
      });
    });

    controls.assigneeIds.forEach((assigneeId) => {
      const selectedAssignee = assigneeOptions.find(
        (option) => option.value === assigneeId,
      );
      const fallback =
        assigneeId === ASSIGNEE_FILTER_VALUES.UNASSIGNED ? "Unassigned" : "Unknown";

      chips.push({
        key: `assignee:${assigneeId}`,
        label: `Assigned: ${selectedAssignee?.label || fallback}`,
        className: "border-border/80 bg-secondary/70 text-foreground",
      });
    });

    if (controls.priorityOrder !== PRIORITY_ORDER_VALUES.NONE) {
      const selectedOrder = PRIORITY_ORDER_OPTIONS.find(
        (option) => option.value === controls.priorityOrder,
      );
      chips.push({
        key: "priorityOrder",
        label: `Sort: ${selectedOrder?.label || controls.priorityOrder}`,
        className: "border-blue-200 bg-blue-50 text-blue-700",
      });
    }

    return chips;
  }, [controls, assigneeOptions]);

  const togglePriority = (value) => {
    const normalized = String(value || "").toLowerCase();

    setControls((prev) => {
      if (normalized === PRIORITY_FILTER_VALUES.ALL) {
        return { ...prev, priorities: [] };
      }

      const exists = prev.priorities.includes(normalized);

      return {
        ...prev,
        priorities: exists
          ? prev.priorities.filter((p) => p !== normalized)
          : [...prev.priorities, normalized],
      };
    });
  };

  const toggleAssignee = (value) => {
    const nextValue = String(value || "");

    setControls((prev) => {
      if (nextValue === ASSIGNEE_FILTER_VALUES.ALL) {
        return { ...prev, assigneeIds: [] };
      }

      const exists = prev.assigneeIds.includes(nextValue);

      return {
        ...prev,
        assigneeIds: exists
          ? prev.assigneeIds.filter((id) => id !== nextValue)
          : [...prev.assigneeIds, nextValue],
      };
    });
  };

  const changePriorityOrder = (value) => {
    setControls((prev) => ({
      ...prev,
      priorityOrder: value || PRIORITY_ORDER_VALUES.NONE,
    }));
  };

  const clearAllFilters = () => {
    setControls({ ...DEFAULT_TICKET_CONTROLS });
  };

  const removeFilterChip = (chipKey) => {
    if (chipKey.startsWith("priority:")) {
      const value = chipKey.replace("priority:", "");
      setControls((prev) => ({
        ...prev,
        priorities: prev.priorities.filter((p) => p !== value),
      }));
      return;
    }

    if (chipKey.startsWith("assignee:")) {
      const value = chipKey.replace("assignee:", "");
      setControls((prev) => ({
        ...prev,
        assigneeIds: prev.assigneeIds.filter((id) => id !== value),
      }));
      return;
    }

    if (chipKey === "priorityOrder") {
      setControls((prev) => ({
        ...prev,
        priorityOrder: PRIORITY_ORDER_VALUES.NONE,
      }));
    }
  };

  return {
    controls,
    queryFilters,
    activeFilterChips,
    togglePriority,
    toggleAssignee,
    changePriorityOrder,
    clearAllFilters,
    removeFilterChip,
  };
}
