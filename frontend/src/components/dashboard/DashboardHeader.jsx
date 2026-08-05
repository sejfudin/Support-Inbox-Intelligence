import { format } from 'date-fns';

const greetingFor = (hour) => {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

const firstName = (fullname = '') => fullname.trim().split(' ')[0] || 'there';

/**
 * Date + greeting, shared by the admin and intern boards.
 *
 * Deliberately has no workspace picker of its own: both boards are scoped to the
 * caller's active workspace, which is switched from the sidebar's
 * `WorkspaceSwitcher` (that already navigates back to /dashboard after a switch).
 * The workspace in view is named further down each board instead.
 *
 * The what's-new entry point used to live here. It moved to the sidebar footer,
 * above the account row (`components/onboarding/WhatsNewButton.jsx`) — the tour
 * covers the shell as much as the boards, so it has to be reachable from any page.
 *
 * `action` is an optional slot on the greeting row itself, for something that has to
 * be seen the moment the board opens. It wraps below the greeting on narrow screens
 * rather than squeezing the name.
 */
export function DashboardHeader({ user, action }) {
  const now = new Date();

  return (
    <header className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {format(now, 'EEEE · MMMM d, yyyy')}
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {greetingFor(now.getHours())}, {firstName(user?.fullname)}{' '}
          <span aria-hidden="true">👋</span>
        </h1>
      </div>

      {action}
    </header>
  );
}
