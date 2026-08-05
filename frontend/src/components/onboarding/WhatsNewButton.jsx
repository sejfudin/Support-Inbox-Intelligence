import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { replayWhatsNewTour, useWhatsNewSeen } from './whatsNewSteps';

/**
 * The way back into the "what moved" tour, in the sidebar footer directly above
 * the account row.
 *
 * It lives here rather than on the dashboard header because the tour is about the
 * *shell* as much as the boards — the sidebar, the collapse control, the account
 * menu — and a viewer on `/tickets` wondering where something went should not have
 * to navigate to a dashboard to be told. Above the account row specifically: that
 * is where the other "about you and this app" controls already are.
 *
 * Filled and gently animated until it has been used, then quiet. "Used" means
 * finished or skipped, not merely opened, and it is remembered per `TOUR_VERSION`,
 * so the next redesign gets to be loud again exactly once. The tour also opens
 * itself on a viewer's first load after a version bump (see `WhatsNewTour`) — this
 * button is how you get it back afterwards, and how you reach it if you dismissed
 * it without reading.
 */
export function WhatsNewButton({ collapsed = false }) {
  const seen = useWhatsNewSeen();
  const label = 'Notice some changes?';

  return (
    // Size is identical in both seen states — only fill, weight and glow change —
    // so the footer never reflows when the pulse stops.
    <button
      type="button"
      data-test="whats-new-button"
      data-tour="whats-new-button"
      onClick={() => replayWhatsNewTour()}
      title={collapsed ? label : undefined}
      aria-label={label}
      className={cn(
        // Kept deliberately compact: it sits in the footer above the account row, so
        // every pixel of height here is taken from the nav list above it, and the
        // admin nav is already the longest one in the app.
        'flex w-full items-center gap-2 rounded-xl border px-2.5 py-1 text-[11px] leading-5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        // Collapsed rail: square, centred, no label — matching the account row's
        // own icon-mode footprint so the two sit flush.
        'group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:px-0',
        seen
          ? 'border-border/60 bg-card/60 font-medium text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-foreground'
          : 'border-primary/50 bg-primary font-semibold text-primary-foreground hover:bg-primary/90 motion-safe:animate-attention-glow'
      )}
    >
      <Sparkles className={cn('size-3.5 shrink-0', seen && 'text-primary')} />
      <span className="min-w-0 truncate group-data-[collapsible=icon]:hidden">{label}</span>
    </button>
  );
}
