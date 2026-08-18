import { Link } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import { InitialsAvatar } from '@/components/ui/initials-avatar';
import { capitalizeFirst } from '@/helpers/capitalizeFirst';
import { CHIP } from '@/helpers/badgeTones';
import { cn } from '@/lib/utils';

/**
 * One of the card's three columns. The mockup gives each a 10.5px/600 uppercase
 * caption tinted by its meaning — done/todo/blockers — over 12.5px body copy, and
 * nothing else: no dots, no bullets, no tinted fill behind the blockers column.
 */
export const ItemColumn = ({
  title,
  captionClassName,
  items,
  emptyLabel,
  renderItem = (item) => item,
  className,
}) => (
  <div className={cn('flex flex-col gap-1.5 px-4 py-3', className)}>
    <span className={cn('text-[10.5px] font-semibold tracking-[0.07em]', captionClassName)}>
      {title}
    </span>
    {items.length === 0 ? (
      <p className="text-[12.5px] leading-[1.5] text-muted-foreground/75">{emptyLabel}</p>
    ) : (
      <ul className="flex flex-col gap-1.5">
        {items.map((item, index) => (
          <li key={index} className="text-pretty text-[12.5px] leading-[1.5] text-foreground/90">
            {renderItem(item)}
          </li>
        ))}
      </ul>
    )}
  </div>
);

// A blocker's linkedTicket is populated at fetch time; it comes back null if the
// ticket was deleted after linking, so a dangling ref just falls back to plain text.
export const BlockerItem = ({ blocker }) => {
  const ticket = blocker.linkedTicket;
  if (!ticket) return blocker.text;

  const archived = ticket.isArchived;

  return (
    <span className="flex flex-col gap-1">
      <span>{blocker.text}</span>
      <Link
        to={`/tickets?ticket=${ticket._id}`}
        data-test={`daily-blocker-ticket-chip-${ticket._id}`}
        className={cn(
          'inline-flex w-fit max-w-full items-center gap-1.5 rounded-[var(--r-badge)] border px-1.5 py-px text-[10.5px] transition-colors',
          archived
            ? 'border-dashed border-muted-foreground/40 text-muted-foreground'
            : 'border-separator hover:bg-accent'
        )}
      >
        <span className="font-semibold tabular-nums">#{ticket.taskNumber}</span>
        <span className="max-w-[140px] truncate">{ticket.subject}</span>
        {archived ? (
          <span className="uppercase tracking-wide">Archived</span>
        ) : (
          ticket.status?.label && (
            <span
              className="rounded-[var(--r-badge)] px-1 font-semibold"
              style={
                ticket.status.color
                  ? { color: ticket.status.color, backgroundColor: `${ticket.status.color}1f` }
                  : undefined
              }
            >
              {ticket.status.label}
            </span>
          )
        )}
      </Link>
    </span>
  );
};

export const DailyEntryCard = ({ entry, isEditable = false, onEdit, onRemove }) => {
  const blockerCount = entry.blockers?.length ?? 0;
  const fullname = entry.member?.fullname || '';

  return (
    <section
      data-test={`daily-entry-card-${entry._id}`}
      className="group overflow-hidden rounded-[var(--r-card)] border border-border bg-card"
    >
      {/* Identity band — 28px avatar, name over role, time flush right. */}
      <div className="flex items-center gap-2.5 border-b border-separator px-4 py-[11px]">
        <InitialsAvatar name={fullname} size="sm" />
        <span className="flex min-w-0 flex-col leading-[1.3]">
          <span className="truncate text-[13px] font-semibold text-foreground">{fullname}</span>
          {entry.member?.role ? (
            <span className="text-[11px] text-muted-foreground/75">
              {capitalizeFirst(entry.member.role)}
            </span>
          ) : null}
        </span>

        <span className="ml-auto flex flex-none items-center gap-2">
          {blockerCount > 0 ? (
            <span
              className={cn(
                CHIP,
                'bg-[hsl(var(--tone-danger)/0.15)] text-[hsl(var(--tone-danger-fg))]'
              )}
            >
              {blockerCount} blocker{blockerCount === 1 ? '' : 's'}
            </span>
          ) : null}
          {isEditable ? (
            <span className="flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
              <button
                type="button"
                data-test={`daily-entry-edit-${entry._id}`}
                aria-label="Edit entry"
                onClick={() => onEdit?.(entry)}
                className="flex h-[22px] w-[22px] items-center justify-center rounded-[var(--r-badge)] text-muted-foreground/75 transition-colors hover:bg-accent hover:text-foreground"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                data-test={`daily-entry-remove-${entry._id}`}
                aria-label="Remove entry"
                onClick={() => onRemove?.(entry)}
                className="flex h-[22px] w-[22px] items-center justify-center rounded-[var(--r-badge)] text-muted-foreground/75 transition-colors hover:bg-accent hover:text-foreground"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </span>
          ) : null}
        </span>
      </div>

      {/* Three equal columns, divided by the card's own outline colour — that is
          what the mockup uses here, not the lighter inner hairline. */}
      <div className="grid divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <ItemColumn
          title="DONE"
          captionClassName="text-[hsl(var(--tone-success-fg))]"
          items={entry.done ?? []}
          emptyLabel="Nothing yet"
        />
        <ItemColumn
          title="TO DO"
          captionClassName="text-[hsl(var(--tone-info-fg))]"
          items={entry.todo ?? []}
          emptyLabel="Nothing planned"
        />
        <ItemColumn
          title="BLOCKERS"
          captionClassName="text-[hsl(var(--tone-danger-fg))]"
          items={entry.blockers ?? []}
          emptyLabel="No blockers"
          renderItem={(blocker) => <BlockerItem blocker={blocker} />}
        />
      </div>
    </section>
  );
};
