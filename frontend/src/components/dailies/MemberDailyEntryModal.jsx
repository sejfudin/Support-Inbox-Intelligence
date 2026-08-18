import { format, parseISO } from 'date-fns';
import { Check, Circle, Clock } from 'lucide-react';
import { DetailModal } from '@/components/interns/DetailModal';
import { ItemColumn, BlockerItem } from '@/components/dailies/DailyEntryCard';
import { useMemberDailyEntry } from '@/queries/dailies';

/**
 * Read-only popup showing one member's standup for one date, opened from
 * either the "Today's standup" card or a coverage-grid cell. Mirrors
 * InternAttendanceModal's structure: a DetailModal shell, a loading/error
 * short-circuit, then either the reported entry (reusing DailyEntryCard's own
 * ItemColumn/BlockerItem markup) or a calm "not submitted" empty state.
 * @param {{ workspaceId: string, selection: { memberId: string, date: string, fullname: string } | null, onClose: () => void }} props
 */
export default function MemberDailyEntryModal({ workspaceId, selection, onClose }) {
  const open = Boolean(selection);
  const { data, isPending, isError } = useMemberDailyEntry(
    workspaceId,
    selection?.memberId,
    selection?.date
  );
  const entry = data?.data;

  const dateLabel = selection?.date ? format(parseISO(selection.date), 'EEEE, MMM d') : '';

  let content;
  if (isPending) {
    content = <p className="py-10 text-center text-sm text-muted-foreground">Loading standup…</p>;
  } else if (isError) {
    content = (
      <p className="py-10 text-center text-sm text-[hsl(var(--tone-danger-fg))]">
        Failed to load this standup.
      </p>
    );
  } else if (!entry?.reported) {
    content = (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <Clock className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm font-medium text-foreground">No standup submitted</p>
        <p className="text-sm text-muted-foreground">
          {selection?.fullname} did not report on this day.
        </p>
      </div>
    );
  } else {
    const blockerCount = entry.blockers?.length ?? 0;
    content = (
      // Stacked, not side-by-side columns — a narrow modal reads better as a
      // short vertical report than a cramped 3-way split.
      <div className="space-y-4">
        <ItemColumn
          title="Done"
          dotColor="bg-[hsl(var(--tone-success))]"
          items={entry.done ?? []}
          emptyLabel="Nothing yet"
          marker={<Check className="mt-1 h-4 w-4 shrink-0 text-[hsl(var(--tone-success-fg))]" />}
        />
        <ItemColumn
          title="To do"
          dotColor="bg-[hsl(var(--tone-info))]"
          items={entry.todo ?? []}
          emptyLabel="Nothing planned"
          marker={<Circle className="mt-1 h-4 w-4 shrink-0 text-[hsl(var(--tone-info))]" />}
        />
        <ItemColumn
          title="Blockers"
          dotColor="bg-[hsl(var(--tone-danger))]"
          items={entry.blockers ?? []}
          emptyLabel="No blockers"
          emptyIsPositive
          marker={
            <span className="mt-2 h-2 w-2 shrink-0 rounded-[2px] bg-[hsl(var(--tone-danger))]" />
          }
          renderItem={(blocker) => <BlockerItem blocker={blocker} />}
          tinted={blockerCount > 0}
        />
      </div>
    );
  }

  const subtitle = [
    dateLabel,
    entry?.reported ? `Reported ${format(new Date(entry.reportedAt), 'HH:mm')}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <DetailModal
      open={open}
      onClose={onClose}
      title={selection?.fullname || 'Standup'}
      subtitle={subtitle}
      className="max-w-lg"
      dataTest="daily-member-entry-modal"
      sections={[{ content }]}
    />
  );
}
