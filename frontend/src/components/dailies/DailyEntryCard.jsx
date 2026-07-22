import { Check, Circle, AlertTriangle, Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const ItemColumn = ({ title, icon: Icon, items, emptyLabel }) => (
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
            {item}
          </li>
        ))}
      </ul>
    )}
  </div>
);

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
          items={(entry.blockers ?? []).map((blocker) => blocker.text)}
          emptyLabel="None"
        />
      </CardContent>
    </Card>
  );
};
