import { format } from 'date-fns';

/** Rail-sized date control: 30px on a hairline, matching the other rail inputs. */
export function TicketDueDateField({ isArchived, dueDateInput, onDueDateChange }) {
  if (isArchived) {
    return (
      <span className="text-[12.5px] font-medium text-foreground">
        {dueDateInput ? (
          format(new Date(dueDateInput), 'MMM d, yyyy')
        ) : (
          <span className="text-muted-foreground/75">—</span>
        )}
      </span>
    );
  }

  return (
    <input
      type="date"
      value={dueDateInput}
      onChange={(e) => onDueDateChange(e.target.value)}
      data-test="ticket-modal-due-date-input"
      className="h-[30px] w-full rounded-[var(--r-control)] border border-separator bg-card px-2 text-[12.5px] font-medium text-foreground outline-none transition focus:border-ring"
    />
  );
}
