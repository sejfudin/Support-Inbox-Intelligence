import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ExampleChip } from './ExampleChip';

// The chips on the "start here" card. Only the flags a person would actually
// call out get one — see `helpers/ticketUrgency.js`, which returns exactly this
// set. `dot` marks the ones the mockup gives a leading bullet: priority is a
// property of the ticket, where overdue/blocked/due-soon are states it is in,
// and the bullet is what separates the two at a glance.
const FLAG_CHIP = {
  blocked: { label: 'Blocked', className: 'bg-red-500/15 text-red-700 dark:text-red-300' },
  critical: {
    label: 'Critical',
    className: 'bg-red-500/15 text-red-700 dark:text-red-300',
    dot: true,
  },
  high: {
    label: 'High',
    className: 'bg-amber-500/20 text-amber-700 dark:text-amber-300',
    dot: true,
  },
  overdue: { label: 'Overdue', className: 'bg-red-500/15 text-red-700 dark:text-red-300' },
  'due-soon': {
    label: 'Due soon',
    className: 'bg-amber-500/20 text-amber-700 dark:text-amber-300',
  },
};

// Render order, independent of the scorer's flag order — the mockup reads
// state-then-priority ("Blocked · Critical · Overdue").
const CHIP_ORDER = ['blocked', 'critical', 'high', 'overdue', 'due-soon'];

const formatDue = (dueDate) => (dueDate ? format(new Date(dueDate), 'MMM d') : 'No date');

/** `#12 · Billing` — the ticket's number and category, when it has one. */
const ticketMeta = (ticket) =>
  [ticket.taskNumber ? `#${ticket.taskNumber}` : null, ticket.category || null]
    .filter(Boolean)
    .join(' · ');

/** Strips the TipTap HTML off a description so it can sit on one line. */
const plainText = (html) =>
  String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

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
 * The one ticket to pick up first, with the reasons it was picked. Everything
 * here — the choice and the chips — comes from the server's urgency score, so
 * the card can never disagree with the ordering of the list below it.
 */
function StartHereCard({ ticket, onOpen }) {
  const summary = plainText(ticket.description);

  return (
    <button
      type="button"
      onClick={() => onOpen(ticket.id)}
      data-test="intern-dashboard-start-here"
      className="w-full rounded-[1rem] border border-primary/25 bg-primary/[0.04] p-4 text-left transition-colors hover:bg-primary/[0.07] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/40"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex shrink-0 items-center rounded-md bg-primary/12 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-primary">
          Start here
        </span>
        <span className="shrink-0 text-[11px] text-muted-foreground">{ticketMeta(ticket)}</span>
      </div>

      <p className="mt-2.5 text-base font-semibold leading-6 text-foreground">{ticket.subject}</p>

      {summary && (
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{summary}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {CHIP_ORDER.filter((flag) => ticket.flags.includes(flag)).map((flag) => {
          const chip = FLAG_CHIP[flag];
          return (
            <span
              key={flag}
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold',
                chip.className
              )}
            >
              {chip.dot && (
                <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
              )}
              {chip.label}
            </span>
          );
        })}
        {ticket.dueDate && (
          <span className="text-[11px] text-muted-foreground">Due {formatDue(ticket.dueDate)}</span>
        )}
        <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
          Open ticket
          <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </button>
  );
}

/**
 * "My tickets", ordered by what needs the intern first.
 *
 * The ordering is the server's (`helpers/ticketUrgency.js`) rather than a sort
 * in this component, so the "start here" pick and the list can't drift apart,
 * and the rule stays unit-testable.
 */
export function MyTicketsPanel({ tickets, onOpenTicket, isPreview = false }) {
  const items = tickets?.items || [];
  const total = tickets?.total ?? 0;
  const [first, ...rest] = items;
  const hiddenCount = Math.max(0, total - items.length);

  return (
    <section
      // This panel sets the bottom row's height, and the rail beside it splits
      // whatever it gets in half — so the floor here is what stops a two-ticket
      // week from collapsing the row into a thin strip and breaking the grid.
      className="app-panel flex min-h-[30rem] w-full flex-col p-4 sm:p-5"
      aria-label="My tickets"
      data-tour="intern-dashboard-tickets"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-6 text-foreground">My tickets</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Ordered by what needs you first</p>
        </div>
        {isPreview && <ExampleChip />}
      </header>

      {total === 0 ? (
        // Centred in the spare height rather than stretched: a dashed box blown
        // up to full panel height reads as a broken container.
        <div className="flex flex-1 flex-col items-center justify-center gap-1.5 py-10 text-center">
          <p className="text-sm font-medium text-foreground">Nothing assigned to you</p>
          <p className="max-w-sm text-xs leading-5 text-muted-foreground">
            When someone assigns you a ticket it will appear here, most urgent first.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-4">
            <StartHereCard ticket={first} onOpen={onOpenTicket} />
          </div>

          {rest.length > 0 && (
            <>
              <div className="mt-5 flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Up next
                </span>
                {hiddenCount > 0 && (
                  <span className="text-[11px] text-muted-foreground">{hiddenCount} more</span>
                )}
              </div>

              <ul className="mt-1 divide-y divide-border/50">
                {rest.map((ticket) => (
                  <li key={ticket.id}>
                    <button
                      type="button"
                      onClick={() => onOpenTicket(ticket.id)}
                      className="flex w-full items-center gap-3 py-2.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary/40"
                    >
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: ticket.status?.color || 'transparent' }}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-foreground">
                          {ticket.subject}
                        </span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {ticketMeta(ticket)}
                        </span>
                      </span>
                      <StatusBadge status={ticket.status} />
                      <span
                        className={cn(
                          'w-16 shrink-0 text-right text-[11px] tabular-nums',
                          ticket.overdue
                            ? 'font-semibold text-red-600 dark:text-red-400'
                            : 'text-muted-foreground'
                        )}
                      >
                        {formatDue(ticket.dueDate)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* mt-auto pushes the footer to the panel's bottom edge, so this column
              ends on the same line as the taller rail beside it. */}
          <div className="mt-auto flex items-center justify-between gap-3 border-t border-border/50 pt-4">
            <span className="text-[11px] text-muted-foreground">
              {total} ticket{total === 1 ? '' : 's'} assigned to you
            </span>
            {/* The shared tickets table with the assignee filter pre-applied,
                rather than a separate "my tickets" page — one table, one set of
                filters, one place for the columns to change. */}
            <Link
              to="/tickets?assignee=me"
              className="text-[11px] font-semibold text-primary hover:underline"
              data-test="intern-dashboard-tickets-link"
            >
              View all →
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
