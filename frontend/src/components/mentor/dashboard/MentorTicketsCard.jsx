import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { DashboardCard, DashboardCardEmpty } from '@/components/dashboard/DashboardCard';
import { useMyTickets } from '@/queries/tickets';

const ROW_LIMIT = 5;

const formatDue = (dueDate) => (dueDate ? format(new Date(dueDate), 'MMM d') : null);

function StatusBadge({ status }) {
  if (!status) return null;
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{ backgroundColor: `${status.color}1f`, color: status.color }}
    >
      {status.label}
    </span>
  );
}

/**
 * Plain assigned-to-me tickets in the active workspace — no urgency scoring
 * like the intern board's `MyTicketsPanel` (fed by a different, richer
 * endpoint this hook doesn't have), which is also what keeps this simpler,
 * matching the rest of this board. `onOpenTicket` is the page's own
 * `useTicketModals().openTicketDetails` — the same details modal every other
 * board opens a ticket through, not a route of its own.
 *
 * Header styled to match `QuickActionsCard` (16px) rather than
 * `DashboardCard`'s own 14px `title` — see the note on `MentorInternsCard`.
 *
 * `min-h-0 flex-1`, same as `MentorNotesCard`: it's the last card in the
 * left column, so it stretches to match the right column's height rather
 * than leaving a gap when both columns are near-empty — the two columns'
 * bottom edges line up because both their last cards stretch, not because
 * either one's natural content happens to reach the same height.
 */
export function MentorTicketsCard({ hasWorkspace, onOpenTicket }) {
  const { data, isPending, isError } = useMyTickets(
    { page: 1, limit: ROW_LIMIT },
    { enabled: hasWorkspace }
  );
  // getMyTickets responds `{ success, data: [...tickets], pagination }` — the
  // list is the envelope's own `data`, not a nested `tickets` field.
  const tickets = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;

  return (
    <DashboardCard data-tour="mentor-dashboard-tickets" className="min-h-0 flex-1">
      <header>
        <h2 className="text-base font-semibold leading-6 text-foreground">My ticket work</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Assigned to you in your active workspace
        </p>
      </header>

      <div className="mt-3 flex min-h-0 flex-1 flex-col">
        {!hasWorkspace && (
          <DashboardCardEmpty>
            No active workspace — switch into one from the sidebar to see your ticket work.
          </DashboardCardEmpty>
        )}

        {hasWorkspace && isPending && (
          <ul className="space-y-3">
            {[0, 1, 2].map((row) => (
              <li key={row} className="flex items-center gap-2.5">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted" />
                <span className="h-3 w-40 flex-1 animate-pulse rounded bg-muted" />
                <span className="h-3 w-10 shrink-0 animate-pulse rounded bg-muted" />
              </li>
            ))}
          </ul>
        )}

        {hasWorkspace && isError && (
          <DashboardCardEmpty>Could not load your tickets.</DashboardCardEmpty>
        )}

        {hasWorkspace && !isPending && !isError && tickets.length === 0 && (
          <DashboardCardEmpty>Nothing assigned to you.</DashboardCardEmpty>
        )}

        {hasWorkspace && !isPending && !isError && tickets.length > 0 && (
          <>
            <ul className="divide-y divide-border/50">
              {tickets.map((ticket) => (
                <li key={ticket._id}>
                  <button
                    type="button"
                    onClick={() => onOpenTicket(ticket._id)}
                    data-test={`mentor-dashboard-ticket-row-${ticket._id}`}
                    className="flex w-full items-center gap-3 py-2.5 text-left transition-colors hover:bg-muted/40"
                  >
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: ticket.status?.color || 'transparent' }}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                      {ticket.subject}
                    </span>
                    <StatusBadge status={ticket.status} />
                    {formatDue(ticket.dueDate) && (
                      <span className="w-14 shrink-0 text-right text-[11px] text-muted-foreground">
                        {formatDue(ticket.dueDate)}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>

            <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3">
              <span className="text-[11px] text-muted-foreground">
                {total} ticket{total === 1 ? '' : 's'} assigned to you
              </span>
              <Link
                to="/tickets?assignee=me"
                className="text-[11px] font-semibold text-primary hover:underline"
                data-test="mentor-dashboard-tickets-link"
              >
                View all →
              </Link>
            </div>
          </>
        )}
      </div>
    </DashboardCard>
  );
}
