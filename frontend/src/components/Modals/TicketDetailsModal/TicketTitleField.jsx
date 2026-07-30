export function TicketTitleField({ title, onTitleChange, isArchived }) {
  if (isArchived) {
    return (
      <h1
        data-test="ticket-modal-title-heading"
        className="w-full min-w-0 break-words px-2 py-1 text-xl font-bold tracking-tight text-foreground sm:text-2xl md:text-3xl lg:text-4xl"
      >
        {title}
      </h1>
    );
  }

  return (
    <input
      type="text"
      value={title}
      onChange={(e) => onTitleChange(e.target.value)}
      data-test="ticket-modal-title-input"
      className={`w-full min-w-0 rounded-lg border border-transparent bg-transparent px-2 py-1 text-xl font-bold tracking-tight outline-none transition sm:text-2xl md:text-3xl lg:text-4xl ${
        !title.trim() ? 'text-destructive' : 'text-foreground'
      } cursor-text hover:bg-muted/50 focus:bg-muted/50 focus:border-border focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background`}
      placeholder="Enter ticket title..."
    />
  );
}
