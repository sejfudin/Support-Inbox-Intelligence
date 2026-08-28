import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { DashboardCard, DashboardCardEmpty } from '@/components/dashboard/DashboardCard';
import { useNotifications, useMarkNotificationRead } from '@/queries/notifications';

const ROW_LIMIT = 5;

/**
 * "Notes for me" — sent by admin/leadership straight to this mentor, not
 * about any intern. Distinct from the mentor's own notes about an intern
 * (the "Write a note" quick action / `NewMentorNoteDialog`), which live on
 * the intern's profile instead — this card only ever shows the staff-to-staff
 * kind, via the `type` filter on the shared notifications feed.
 *
 * `min-h-0 flex-1` (same as `TodayStandupCard` on the admin board): this is
 * the last card in the rail, so it stretches to match the main column's
 * height rather than leaving the rail visibly shorter — the grid already
 * stretches the rail's wrapper to that height, this is what makes the last
 * card in it actually fill it. Header matches `QuickActionsCard`'s 16px
 * style above it, not `DashboardCard`'s own 14px `title` — see the note on
 * `MentorInternsCard`.
 */
export function MentorNotesCard() {
  const { data, isPending, isError } = useNotifications({
    type: 'mentor_note_from_staff',
    limit: ROW_LIMIT,
  });
  const { mutate: markRead, isPending: isMarking } = useMarkNotificationRead();
  const notes = data?.data ?? [];

  return (
    <DashboardCard data-tour="mentor-dashboard-notes" className="min-h-0 flex-1">
      <header>
        <h2 className="text-base font-semibold leading-6 text-foreground">Notes for me</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">Sent by admin or leadership</p>
      </header>

      <div className="mt-3 flex min-h-0 flex-1 flex-col">
        {isPending && (
          <ul className="space-y-3">
            {[0, 1].map((row) => (
              <li key={row} className="space-y-1.5">
                <span className="block h-3 w-32 animate-pulse rounded bg-muted" />
                <span className="block h-2.5 w-full animate-pulse rounded bg-muted" />
              </li>
            ))}
          </ul>
        )}

        {isError && <DashboardCardEmpty>Could not load your notes.</DashboardCardEmpty>}

        {!isPending && !isError && notes.length === 0 && (
          <DashboardCardEmpty>
            No notes yet — they'll show up here when one arrives.
          </DashboardCardEmpty>
        )}

        {!isPending && !isError && notes.length > 0 && (
          <ul className="-mx-1.5 divide-y divide-border/50">
            {notes.map((note) => {
              const created = note.createdAt ? new Date(note.createdAt) : null;
              const timeLabel =
                created && !Number.isNaN(created.getTime())
                  ? formatDistanceToNow(created, { addSuffix: true })
                  : '';

              return (
                <li key={note._id}>
                  <button
                    type="button"
                    onClick={() => !note.read && markRead(note._id)}
                    disabled={note.read || isMarking}
                    data-test={`mentor-dashboard-note-row-${note._id}`}
                    className={cn(
                      'w-full rounded-[var(--r-control)] px-1.5 py-2.5 text-left transition-colors',
                      note.read ? 'cursor-default' : 'cursor-pointer hover:bg-muted/40'
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {!note.read && (
                        <span
                          className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                          aria-hidden="true"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold leading-4 text-foreground">
                          {note.title}
                        </p>
                        {note.body && (
                          <p className="mt-0.5 line-clamp-2 text-[12px] leading-4 text-muted-foreground">
                            {note.body}
                          </p>
                        )}
                        {timeLabel && (
                          <p className="mt-1 text-[10px] text-muted-foreground">{timeLabel}</p>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </DashboardCard>
  );
}
