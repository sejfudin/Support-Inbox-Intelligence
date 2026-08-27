import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowRight, Settings2 } from 'lucide-react';

import { useStoredPreference } from '@/hooks/useStoredPreference';
import {
  QUICK_ACTIONS_STORAGE_KEY,
  decodeQuickActionSelection,
  isValidQuickActionOrder,
  resolveQuickActions,
} from '@/helpers/quickActions';

/**
 * The quick actions, as this account chose them.
 *
 * The list lives in `helpers/quickActions.js` — catalog, role filter, and the
 * merge of the account's selection onto it, all unit-tested. This file only
 * draws the rows, which is what lets the same card serve the mentor dashboard
 * once that page exists.
 *
 * **There is nothing to configure here.** Which five actions, and in what order,
 * is edited in Settings (`components/settings/QuickActionsRows.jsx`) — every row
 * on this card is a link or a button, and an editor sharing those five rows means
 * drag and click fighting over the same pointer. So the card stays a plain list
 * of click targets and the header points at the one place that changes it.
 *
 * The selection is an account preference, so it follows the person across
 * browsers; an account that has never chosen gets the shipped default — the first
 * `QUICK_ACTIONS_DEFAULT_COUNT` of their role's catalog.
 *
 * ⚠️  **TODO(quick-actions): this card will currently draw as many rows as the
 * account picked, because `QUICK_ACTIONS_MAX` is temporarily `null`.** Five is the
 * design — the rail is sized for it and the bottom row is meant to end level with
 * the interns panel. Restore the cap (see the banner in `helpers/quickActions.js`)
 * before shipping; the limit was left off deliberately so every action could be
 * tested from here.
 */

const ROW_CLASS =
  'group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

function ActionIcon({ icon: Icon }) {
  return (
    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--r-control)] bg-primary/10 text-primary">
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}

/** A count worth chasing — a pending queue — rather than a decoration. */
function ActionBadge({ count }) {
  if (!count) return null;
  return (
    <span className="shrink-0 rounded-full bg-[hsl(var(--tone-warning)/0.2)] px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-[hsl(var(--tone-warning-fg))]">
      {count > 99 ? '99+' : count}
    </span>
  );
}

function RowBody({ action, badge, trailing }) {
  return (
    <>
      <ActionIcon icon={action.icon} />
      <span className="min-w-0 flex-1 truncate">{action.label}</span>
      <ActionBadge count={badge} />
      {trailing}
    </>
  );
}

/** The everyday row: navigate, open a modal on the parent page, or admit it is not built. */
function ActionRow({ action, badge, onAction }) {
  const dataTest = `admin-dashboard-action-${action.key}`;

  if (action.opens) {
    return (
      <button
        type="button"
        data-test={dataTest}
        onClick={() => onAction?.(action.key)}
        className={`${ROW_CLASS} text-foreground hover:bg-primary/[0.06]`}
      >
        <RowBody
          action={action}
          badge={badge}
          trailing={
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          }
        />
      </button>
    );
  }

  if (action.pending) {
    return (
      <button
        type="button"
        data-test={dataTest}
        onClick={() =>
          toast.info(`${action.label} is not implemented yet.`, {
            description: 'This action is part of a follow-up change.',
          })
        }
        className={`${ROW_CLASS} text-muted-foreground hover:bg-muted/60`}
      >
        <RowBody
          action={action}
          badge={badge}
          trailing={
            <span className="shrink-0 rounded-full border border-border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              Soon
            </span>
          }
        />
      </button>
    );
  }

  return (
    <Link
      to={action.to}
      data-test={dataTest}
      className={`${ROW_CLASS} text-foreground hover:bg-primary/[0.06]`}
    >
      <RowBody
        action={action}
        badge={badge}
        trailing={
          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
        }
      />
    </Link>
  );
}

export function QuickActionsCard({ role, onAction, badges = {} }) {
  const [cached] = useStoredPreference(QUICK_ACTIONS_STORAGE_KEY, '', isValidQuickActionOrder);
  const actions = resolveQuickActions(decodeQuickActionSelection(cached), role);

  return (
    <section
      data-tour="dashboard-quick-actions"
      className="app-panel-soft shrink-0 p-4 sm:p-5"
      aria-label="Quick actions"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold leading-6 text-foreground">Quick actions</h2>

        <Link
          to="/settings#quick-actions"
          className="inline-flex shrink-0 items-center gap-1 rounded-[var(--r-control)] px-1.5 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          data-test="admin-dashboard-actions-customize"
        >
          <Settings2 className="h-3 w-3" />
          Customize
        </Link>
      </div>

      {/* The section renders even with nothing in it, deliberately twice over: it
          is a what's-new tour anchor, and an account that removed every action
          needs the way back rather than a card that quietly vanished. */}
      {actions.length === 0 ? (
        <p className="mt-3 text-[12.5px] leading-5 text-muted-foreground">
          No quick actions chosen.{' '}
          <Link to="/settings#quick-actions" className="font-semibold text-primary hover:underline">
            Pick some in Settings
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-3 -mx-1 space-y-0.5">
          {actions.map((action) => (
            <li key={action.key}>
              <ActionRow action={action} badge={badges[action.key]} onAction={onAction} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
