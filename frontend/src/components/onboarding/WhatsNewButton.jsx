import { cn } from '@/lib/utils';
import {
  TOUR_ENABLED,
  replayWhatsNewTour,
  useHasWhatsNewSteps,
  useWhatsNewHighlight,
} from './whatsNewSteps';

/**
 * The way into the "what moved" tour, in the sidebar footer directly above the
 * account row. **It is the only way in** — nothing opens the tour on its own, so
 * this button is the whole of the invitation. See `TOUR_REPLAY_EVENT` in
 * `whatsNewSteps.js` for why an invitation replaced the interruption.
 *
 * It lives here rather than on the dashboard header because the tour is about the
 * *shell* as much as the boards — the sidebar, the collapse control, the account
 * menu — and a viewer on `/tickets` wondering where something went should not have
 * to navigate to a dashboard to be told. Above the account row specifically: that
 * is where the other "about you and this app" controls already are.
 *
 * **A NEW badge where the icon used to be.** It has been a sparkle and a megaphone,
 * and both were the same mistake: a picture standing in for a word, next to a label
 * two words long. The badge is the word — and it is the *same* badge this sidebar
 * puts beside a nav row a release touched (`useNewFeatureRoutes`), so the footer and
 * the nav read as one signal with one meaning, explained by the one control that
 * carries both. Read the tour and every one of them goes at once.
 *
 * **Two states, one shape, and the badge is in both.** Unread: the badge in the
 * accent's own light on a filled gradient, a glass highlight, a second line, and two
 * slow animations — a breathing `attention-glow` and the `whats-new-sheen` gleam that
 * crosses the surface and then rests. Read: the *same* badge and label, drained —
 * greys on a muted card, no fill, no motion, no second line.
 *
 * Keeping the badge when there is nothing new sounds like a lie and is not one: drained
 * of colour it stops being a signal and becomes part of the button's name, which is
 * what makes the loud state legible when it returns. The reader has already met this
 * control announcing a release; the same badge lighting up is a change they can read at
 * a glance, where a badge appearing out of nowhere is just a new thing to parse.
 *
 * The height is fixed rather than driven by content, so the second line arriving or
 * leaving cannot move the footer or the nav list above it — which matters most at the
 * exact moment the tour is closed, when the signal stops on a frame the reader is
 * looking at.
 *
 * **Shiny, and tuned to stay on the right side of it.** The first version glowed at
 * near-full opacity with a 20px spread and swept every 2.8s: two loud moving things on
 * a 38px control, in the corner of the eye of somebody trying to read a dashboard. The
 * strengths in `index.css` are now about a third of that and both cycles are slower,
 * with the gleam parked off-canvas for more than half of its own — see the keyframes.
 * The rule to hold if you retune it: the button should catch a glance already passing
 * over the footer, and never pull one off the page.
 *
 * "Read" means the tour was finished or escaped out of, not merely opened, and it is
 * remembered per `TOUR_VERSION` — so the next release gets to be loud again exactly
 * once. `useWhatsNewHighlight` also folds in the standing opt-out from Settings, which
 * silences the signal without hiding the button.
 */
export function WhatsNewButton({ collapsed = false }) {
  // Not `useWhatsNewSeen`: the badge, the second line and the two animations are one
  // signal with one answer, and it is the same answer the sidebar's NEW pills use.
  const highlight = useWhatsNewHighlight();
  const hasSteps = useHasWhatsNewSteps();
  const label = "What's new";

  // Two ways there is nothing to open, and both render no entry point at all rather
  // than a button that does nothing: the tour switched off for the deploy
  // (`TOUR_ENABLED`), and a script with no step that applies to this viewer — which is
  // a state a one-release-wide script can genuinely reach. See `useHasWhatsNewSteps`.
  if (!TOUR_ENABLED || !hasSteps) return null;

  // The collapsed rail has room for exactly one thing, and with no icon any more that
  // thing is the badge. So once the tour has been read there is nothing left to draw
  // there, and an empty 32px tile is worse than no tile: the button steps out of the
  // rail and comes back when the next release lands. Expanding the sidebar (or the
  // mobile sheet, which always renders full width) is how you reach the tour in the
  // meantime — the rail is a deliberate "show me less", and this is the less.
  if (collapsed && !highlight) return null;

  return (
    <button
      type="button"
      data-test="whats-new-button"
      data-tour="whats-new-button"
      onClick={() => replayWhatsNewTour()}
      title={collapsed ? label : undefined}
      // The badge and the second line are decorative, so "there is something unread"
      // has to reach a screen reader through the name instead — otherwise the two
      // states are announced identically and the one piece of information here is the
      // difference between them.
      aria-label={highlight ? `${label} — unread release notes` : label}
      className={cn(
        // Fixed height, so the two states have one footprint — see the note above.
        'relative flex h-[38px] w-full items-center gap-2 overflow-hidden rounded-[var(--r-card)] border px-2.5 text-left transition-[colors,transform] duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-safe:active:scale-[0.985]',
        // Collapsed rail: square, centred, no text — matching the account row's own
        // icon-mode footprint so the two sit flush.
        'group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:px-0',
        highlight
          ? // A gentle diagonal so the surface has a direction, plus a 1px inset
            // white line along the top edge — the lit-from-above read every raised
            // control in the app has, and half of what makes the fill look like
            // glass for the gleam to travel over. The glow comes from the animation.
            'border-primary/50 bg-[linear-gradient(135deg,hsl(var(--primary)),hsl(var(--primary)/0.88))] text-primary-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.18)] motion-safe:animate-attention-glow'
          : 'border-border/50 bg-muted-foreground/[0.06] text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-foreground'
      )}
    >
      {/* The gleam travelling left to right. One class rather than a stack of
          utilities, and defined in `index.css` — see the block there for why it is
          not in `tailwind.config.js` beside the glow. Decorative, so `aria-hidden`;
          it hides itself entirely under reduced motion. */}
      {highlight ? <span aria-hidden="true" className="whats-new-sheen" /> : null}

      {/* Leading, where the icon was, and present in both states — see the note
          above on why the read state keeps it. Unread it is inverted against the fill
          (it sits *on* the accent rather than beside it, unlike the nav's tinted
          pills); read, it is a grey on grey with no hue left in it at all.
          `aria-hidden`: `aria-label` above already carries the word, and in the read
          state the word is decoration rather than information. */}
      <span
        aria-hidden="true"
        className={cn(
          'relative flex h-[17px] shrink-0 items-center rounded-full px-1.5 text-[9px] font-bold uppercase tracking-[0.08em] transition-colors',
          highlight
            ? 'bg-primary-foreground/25 text-primary-foreground'
            : 'bg-muted-foreground/10 text-muted-foreground/60'
        )}
      >
        New
      </span>

      <span className="relative flex min-w-0 flex-1 flex-col group-data-[collapsible=icon]:hidden">
        <span
          className={cn(
            'min-w-0 truncate text-[11.5px] leading-[15px]',
            highlight ? 'font-semibold' : 'font-medium text-muted-foreground/80'
          )}
        >
          {label}
        </span>
        {/* Only while there is something to read: it is what the badge beside it
            means. Once read, the label stands alone and centres itself in the same
            box — the button does not need a line of copy to say it can be pressed. */}
        {highlight ? (
          <span className="min-w-0 truncate text-[10px] leading-[13px] text-primary-foreground/75">
            Something new to read
          </span>
        ) : null}
      </span>
    </button>
  );
}
