import { format } from 'date-fns';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { replayWhatsNewTour, useWhatsNewSeen } from '@/components/onboarding/whatsNewSteps';

const greetingFor = (hour) => {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

const firstName = (fullname = '') => fullname.trim().split(' ')[0] || 'there';

/**
 * The only way into the "what moved" tour.
 *
 * This replaces two things: a `What's new` item buried in the user menu, and the
 * tour launching itself over the dashboard on first login. The overlay-on-arrival
 * is what everybody clicks past without reading, so the invitation is the button
 * instead — filled and gently animated until it has been used, then quiet, and
 * phrased as the question the person is already asking.
 *
 * "Used" means finished or skipped, not merely opened, and it is remembered per
 * `TOUR_VERSION`, so the next redesign gets to be loud again exactly once.
 */
function WhatsNewButton() {
  const seen = useWhatsNewSeen();

  return (
    // Same size in both states — only the fill, the weight and the glow change, so
    // nothing in the header reflows when the pulse stops.
    <button
      type="button"
      data-test="whats-new-button"
      onClick={() => replayWhatsNewTour()}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        seen
          ? 'border-border/60 bg-card/60 font-medium text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-foreground'
          : 'border-primary/50 bg-primary font-semibold text-primary-foreground hover:bg-primary/90 motion-safe:animate-attention-glow'
      )}
    >
      <Sparkles className={cn('size-3.5 shrink-0', seen && 'text-primary')} />
      Notice some changes?
    </button>
  );
}

/**
 * Date + greeting, shared by the admin and intern boards.
 *
 * Deliberately has no workspace picker of its own: both boards are scoped to the
 * caller's active workspace, which is switched from the sidebar's
 * `WorkspaceSwitcher` (that already navigates back to /dashboard after a switch).
 * The workspace in view is named further down each board instead.
 */
export function DashboardHeader({ user }) {
  const now = new Date();

  return (
    <header className="flex min-w-0 items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {format(now, 'EEEE · MMMM d, yyyy')}
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {greetingFor(now.getHours())}, {firstName(user?.fullname)}{' '}
          <span aria-hidden="true">👋</span>
        </h1>
      </div>

      <WhatsNewButton />
    </header>
  );
}
