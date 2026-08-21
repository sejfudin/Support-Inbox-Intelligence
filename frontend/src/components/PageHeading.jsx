import { cn } from '@/lib/utils';

/**
 * The one page header. A flat band across the top of the content column —
 * breadcrumb, title, one-line subtitle, actions right-aligned on the same band —
 * closed by a hairline. No card, no shadow, no kicker badge: the overhaul moved
 * the app off the hero-panel pattern, and the eyebrow line is now the breadcrumb.
 *
 * It bleeds out of `.app-page-content`'s gutter via `.app-page-header`, so it
 * spans the full column even though pages render it inside their section. A page
 * that renders it outside that container passes `bleed={false}`.
 *
 * Two rules the band has to keep:
 *
 * - **88px tall without tabs.** Whatever a page has to say about itself fits in
 *   an eyebrow, a title and one line. A second line of subtitle, a stat strip or
 *   a second row of actions belongs in the first card, not up here.
 * - **Search sits left of the primary action**, at the same height as it. A 32px
 *   search beside a 40px button is the single most visible inconsistency the
 *   library exists to remove, so pass both through `actions` and let the row
 *   align them rather than placing search somewhere else on the band.
 *
 * `tabs` renders flush on the bottom hairline, so the active tab's underline and
 * the band's border are the same line — that is what makes tabs read as part of
 * the header rather than as a strip floating under it.
 */
export default function PageHeading({
  crumb,
  title,
  subtitle,
  actions,
  meta,
  tabs,
  titleAdornment,
  beforeTitle,
  children,
  bleed = true,
  className,
}) {
  return (
    <div
      className={cn(
        bleed ? 'app-page-header' : 'border-b border-border pb-4',
        // Tabs supply the closing hairline themselves; keeping the band's own
        // would draw it twice, two pixels apart.
        tabs && 'border-b-0 pb-0',
        className
      )}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-6">
        <div className="flex min-w-0 flex-col gap-0.5">
          {beforeTitle ? <div className="mb-2">{beforeTitle}</div> : null}
          {crumb ? <span className="app-crumb">{crumb}</span> : null}
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="app-title break-words">{title}</h1>
            {titleAdornment}
          </div>
          {subtitle ? <p className="app-subtitle">{subtitle}</p> : null}
        </div>

        {/* The 14px nudge is what lines the actions up with the title rather than
            with the breadcrumb above it. */}
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 md:pt-[14px]">{actions}</div>
        ) : null}
      </div>

      {meta ? <div className="mt-3">{meta}</div> : null}
      {children ? <div className="mt-3 border-t border-separator pt-3">{children}</div> : null}

      {/* Pulled back out to the band's own edges, so the tab strip's hairline
          runs the full width of the header rather than stopping at the gutter. */}
      {tabs ? <div className="mt-3">{tabs}</div> : null}
    </div>
  );
}
