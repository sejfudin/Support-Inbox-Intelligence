import { Link } from 'react-router-dom';
import { Check, Circle, Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getInitials } from '@/helpers/getInitials';
import { getAvatarColor } from '@/helpers/avatarColor';
import { capitalizeFirst } from '@/helpers/capitalizeFirst';
import { cn } from '@/lib/utils';

const ItemColumn = ({
  title,
  dotColor,
  items,
  emptyLabel,
  emptyIsPositive,
  marker,
  renderItem = (item) => item,
  tinted = false,
}) => (
  <div
    className={cn(
      'flex flex-col gap-2 rounded-lg px-3 py-2',
      tinted && 'bg-red-50/60 dark:bg-red-950/10'
    )}
  >
    <div className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
      <span className={cn('h-2 w-2 shrink-0 rounded-full', dotColor)} />
      {title}
    </div>
    {items.length === 0 ? (
      <p
        className={cn(
          'flex items-center gap-1.5 text-base',
          emptyIsPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
        )}
      >
        {emptyIsPositive && <Check className="h-4 w-4 shrink-0" />}
        {emptyLabel}
      </p>
    ) : (
      <ul className="flex flex-col gap-2 text-base">
        {items.map((item, index) => (
          <li key={index} className="flex items-start gap-2 leading-snug">
            {marker}
            <span className="flex-1">{renderItem(item)}</span>
          </li>
        ))}
      </ul>
    )}
  </div>
);

// A blocker's linkedTicket is populated at fetch time; it comes back null if the
// ticket was deleted after linking, so a dangling ref just falls back to plain text.
const BlockerItem = ({ blocker }) => {
  const ticket = blocker.linkedTicket;
  if (!ticket) return blocker.text;

  const archived = ticket.isArchived;

  return (
    <div className="flex flex-col gap-1">
      <span>{blocker.text}</span>
      <Link
        to={`/tickets?ticket=${ticket._id}`}
        data-test={`daily-blocker-ticket-chip-${ticket._id}`}
        className={cn(
          'inline-flex w-fit max-w-full items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs transition-colors',
          archived
            ? 'border-dashed border-muted-foreground/40 text-muted-foreground'
            : 'border-input hover:bg-muted'
        )}
      >
        <span className="font-medium">#{ticket.taskNumber}</span>
        <span className="max-w-[140px] truncate">{ticket.subject}</span>
        {archived ? (
          <span className="text-[10px] uppercase tracking-wide">Archived</span>
        ) : (
          ticket.status?.label && (
            <span
              className="rounded px-1 text-[10px] font-semibold"
              style={
                ticket.status.color
                  ? {
                      color: ticket.status.color,
                      backgroundColor: `${ticket.status.color}1a`,
                    }
                  : undefined
              }
            >
              {ticket.status.label}
            </span>
          )
        )}
      </Link>
    </div>
  );
};

export const DailyEntryCard = ({ entry, isEditable = false, onEdit, onRemove }) => {
  const blockerCount = entry.blockers?.length ?? 0;
  const fullname = entry.member?.fullname || '';

  return (
    <Card data-test={`daily-entry-card-${entry._id}`} className="group overflow-hidden">
      <CardHeader className="flex flex-row items-start justify-between gap-2 border-b border-border/60 bg-muted/40 py-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-semibold',
              getAvatarColor(fullname)
            )}
          >
            {getInitials(fullname)}
          </div>
          <div className="flex flex-col">
            <CardTitle className="text-xl">{fullname}</CardTitle>
            {entry.member?.role && (
              <span className="text-sm text-muted-foreground">
                {capitalizeFirst(entry.member.role)}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {blockerCount > 0 && (
            <Badge className="gap-1.5 border-transparent bg-red-50 px-3 py-1 text-sm text-red-600 hover:bg-red-50 dark:bg-red-950/40 dark:text-red-400">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              {blockerCount} blocker{blockerCount === 1 ? '' : 's'}
            </Badge>
          )}
          {isEditable && (
            <div className="flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
              <Button
                variant="ghost"
                size="icon"
                data-test={`daily-entry-edit-${entry._id}`}
                aria-label="Edit entry"
                onClick={() => onEdit?.(entry)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                data-test={`daily-entry-remove-${entry._id}`}
                aria-label="Remove entry"
                onClick={() => onRemove?.(entry)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="grid divide-y divide-border/50 pt-6 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <ItemColumn
          title="Done"
          dotColor="bg-emerald-500"
          items={entry.done ?? []}
          emptyLabel="Nothing yet"
          marker={
            <Check className="mt-1 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          }
        />
        <ItemColumn
          title="To do"
          dotColor="bg-blue-500"
          items={entry.todo ?? []}
          emptyLabel="Nothing planned"
          marker={<Circle className="mt-1 h-4 w-4 shrink-0 text-blue-500" />}
        />
        <ItemColumn
          title="Blockers"
          dotColor="bg-red-500"
          items={entry.blockers ?? []}
          emptyLabel="No blockers"
          emptyIsPositive
          marker={<span className="mt-2 h-2 w-2 shrink-0 rounded-[2px] bg-red-500" />}
          renderItem={(blocker) => <BlockerItem blocker={blocker} />}
          tinted={blockerCount > 0}
        />
      </CardContent>
    </Card>
  );
};
