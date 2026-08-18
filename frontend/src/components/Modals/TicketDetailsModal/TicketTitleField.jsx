import { cn } from '@/lib/utils';

/**
 * The mockup's modal title: 20px/600 at -0.015em, the same size as a page `h1`.
 * It used to scale up to 36px (`lg:text-4xl`), which made the ticket subject the
 * loudest thing on screen and pushed the description below the fold.
 */
const TITLE_CLASS =
  'w-full min-w-0 text-[20px] font-semibold leading-[1.25] tracking-[-0.015em] text-pretty';

export function TicketTitleField({ title, onTitleChange, isArchived }) {
  if (isArchived) {
    return (
      <h2
        data-test="ticket-modal-title-heading"
        className={cn(TITLE_CLASS, 'break-words text-foreground')}
      >
        {title}
      </h2>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <input
        type="text"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        data-test="ticket-modal-title-input"
        className={cn(
          TITLE_CLASS,
          '-mx-2 cursor-text rounded-[var(--r-control)] border border-transparent bg-transparent px-2 py-1 outline-none transition hover:bg-accent/50 focus:border-border focus:bg-accent/50',
          title.trim() ? 'text-foreground' : 'text-[hsl(var(--tone-danger-fg))]'
        )}
        placeholder="Enter ticket title…"
      />
      {!title.trim() ? (
        <span className="text-[11px] font-medium text-[hsl(var(--tone-danger-fg))]">
          Title is required
        </span>
      ) : null}
    </div>
  );
}
