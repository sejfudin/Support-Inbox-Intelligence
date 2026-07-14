import { format } from 'date-fns';

export function TicketDueDateField({ isArchived, dueDateInput, onDueDateChange }) {
  if (isArchived) {
    return (
      <div className="flex min-h-[40px] items-center px-1 text-sm font-semibold text-foreground">
        {dueDateInput ? (
          format(new Date(dueDateInput), 'MMM d, yyyy')
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </div>
    );
  }

  return (
    <input
      type="date"
      value={dueDateInput}
      onChange={(e) => onDueDateChange(e.target.value)}
      data-test="ticket-modal-due-date-input"
      className="h-10 w-full rounded-md border border-transparent bg-muted px-3 text-sm font-semibold text-foreground shadow-sm outline-none transition focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
    />
  );
}
