import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowRight, CalendarX, ClipboardCheck, Send, SquarePen, UserPlus } from 'lucide-react';

/**
 * The five quick actions from the mockup.
 *
 * Every action is declared in ONE list so wiring one up is a single-line change.
 * An action either navigates (`to`), opens something on this page (`opens`, handled
 * by the parent via `onAction`), or is not built yet (`pending`) — and a pending
 * action says so out loud rather than silently doing nothing.
 *
 * `Mark absence / excuse` is the only one still pending, and not for want of a UI:
 * the Attendance model has no write path for absence at all. Absence is the *lack*
 * of a check-in record and only interns may check in, so there is no endpoint to
 * call. It needs a backend change first, not a modal.
 */
const QUICK_ACTIONS = [
  { key: 'assign-ticket', label: 'Assign a ticket', icon: ClipboardCheck, opens: true },
  { key: 'recommend-intern', label: 'Recommend intern', icon: Send, opens: true },
  { key: 'write-evaluation', label: 'Write evaluation', icon: SquarePen, opens: true },
  { key: 'mark-absence', label: 'Mark absence / excuse', icon: CalendarX, pending: true },
  { key: 'add-intern', label: 'Add intern', icon: UserPlus, to: '/register' },
];

const ROW_CLASS =
  'group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

function ActionIcon({ icon: Icon }) {
  return (
    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--r-control)] bg-primary/10 text-primary">
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}

export function QuickActionsCard({ onAction }) {
  return (
    <section
      data-tour="dashboard-quick-actions"
      className="app-panel-soft shrink-0 p-4 sm:p-5"
      aria-label="Quick actions"
    >
      <h2 className="text-base font-semibold leading-6 text-foreground">Quick actions</h2>

      <ul className="mt-3 -mx-1 space-y-0.5">
        {QUICK_ACTIONS.map((action) => (
          <li key={action.key}>
            {action.opens ? (
              <button
                type="button"
                data-test={`admin-dashboard-action-${action.key}`}
                onClick={() => onAction?.(action.key)}
                className={`${ROW_CLASS} text-foreground hover:bg-primary/[0.06]`}
              >
                <ActionIcon icon={action.icon} />
                <span className="min-w-0 flex-1 truncate">{action.label}</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </button>
            ) : action.pending ? (
              <button
                type="button"
                data-test={`admin-dashboard-action-${action.key}`}
                onClick={() =>
                  toast.info(`${action.label} is not implemented yet.`, {
                    description: 'This action is part of a follow-up change.',
                  })
                }
                className={`${ROW_CLASS} text-muted-foreground hover:bg-muted/60`}
              >
                <ActionIcon icon={action.icon} />
                <span className="min-w-0 flex-1 truncate">{action.label}</span>
                <span className="shrink-0 rounded-full border border-border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Soon
                </span>
              </button>
            ) : (
              <Link
                to={action.to}
                data-test={`admin-dashboard-action-${action.key}`}
                className={`${ROW_CLASS} text-foreground hover:bg-primary/[0.06]`}
              >
                <ActionIcon icon={action.icon} />
                <span className="min-w-0 flex-1 truncate">{action.label}</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
