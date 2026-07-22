import { Link } from 'react-router-dom';
import { Check, Circle, AlertTriangle, Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const ItemColumn = ({ title, icon: Icon, items, emptyLabel, renderItem = (item) => item }) => (
  <div className="flex flex-col gap-1.5">
    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      {title}
    </div>
    {items.length === 0 ? (
      <p className="text-sm text-muted-foreground">{emptyLabel}</p>
    ) : (
      <ul className="flex flex-col gap-1 text-sm">
        {items.map((item, index) => (
          <li key={index} className="leading-snug">
            {renderItem(item)}
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

  return (
    <Card data-test={`daily-entry-card-${entry._id}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-base">{entry.member?.fullname}</CardTitle>
        <div className="flex items-center gap-2">
          {blockerCount > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              {blockerCount} blocker{blockerCount === 1 ? '' : 's'}
            </Badge>
          )}
          {isEditable && (
            <>
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
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-3">
        <ItemColumn title="Done" icon={Check} items={entry.done ?? []} emptyLabel="Nothing yet" />
        <ItemColumn
          title="To do"
          icon={Circle}
          items={entry.todo ?? []}
          emptyLabel="Nothing planned"
        />
        <ItemColumn
          title="Blockers"
          icon={AlertTriangle}
          items={entry.blockers ?? []}
          emptyLabel="None"
          renderItem={(blocker) => <BlockerItem blocker={blocker} />}
        />
      </CardContent>
    </Card>
  );
};
