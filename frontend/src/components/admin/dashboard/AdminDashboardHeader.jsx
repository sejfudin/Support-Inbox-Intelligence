import { format } from 'date-fns';

const greetingFor = (hour) => {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

const firstName = (fullname = '') => fullname.trim().split(' ')[0] || 'there';

/**
 * Date + greeting. Deliberately has no workspace picker of its own: the board is
 * scoped to the caller's active workspace, which is switched from the sidebar's
 * `WorkspaceSwitcher` (that already navigates back to /dashboard after a switch).
 * The workspace currently in view is named on the interns panel below.
 */
export function AdminDashboardHeader({ user }) {
  const now = new Date();

  return (
    <header className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {format(now, 'EEEE · MMMM d, yyyy')}
      </p>
      <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        {greetingFor(now.getHours())}, {firstName(user?.fullname)}{' '}
        <span aria-hidden="true">👋</span>
      </h1>
    </header>
  );
}
