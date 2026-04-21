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

/** Local calendar date for `<input type="date" min="…">`. */
export function minDueDateInputValue() {
  return format(new Date(), "yyyy-MM-dd");
}

/**
 * `value` is from `<input type="date">`. Only full `yyyy-MM-dd` is checked so
 * partial values while typing (e.g. `2026-04-2`) do not string-compare as "past".
 * Same noon-local anchor as elsewhere when persisting due dates.
 */
export function isDueDateInputInPast(value) {
  if (!value || typeof value !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const due = startOfDay(new Date(`${value}T12:00:00`));
  if (Number.isNaN(due.getTime())) return false;
  const today = startOfDay(new Date());
  return isBefore(due, today);
}
