import { format, startOfDay, isBefore } from "date-fns";

const DONE = "done";

/**
 * Ticket is overdue when there is a due date before today (local) and status is not done.
 */
export function isDueDateOverdue(dueDate, status) {
  if (!dueDate) return false;
  const s = (status || "").toLowerCase();
  if (s === DONE) return false;
  const due = startOfDay(new Date(dueDate));
  const today = startOfDay(new Date());
  return isBefore(due, today);
}

export function formatDueDateDisplay(dueDate) {
  if (!dueDate) return null;
  try {
    return format(new Date(dueDate), "MMM d, yyyy");
  } catch {
    return null;
  }
}

export function dueDateToInputValue(dueDate) {
  if (!dueDate) return "";
  try {
    return format(new Date(dueDate), "yyyy-MM-dd");
  } catch {
    return "";
  }
}
