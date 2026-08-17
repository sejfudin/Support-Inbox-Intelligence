import { cn } from '@/lib/utils';

/**
 * One analytics card: a title block on the band across the top, an optional
 * right-aligned action, and the chart (or whatever else) in the body below.
 *
 * With no `children` it renders the band alone, which is how a page introduces a
 * group of cards without wrapping them — see `PersonalAnalyticsSection`, where the
 * section title sits above a stat row and two charts rather than around them.
 *
 * Geometry comes from the token layer (`--r-card` via `.app-panel`, `--r-tile` for
 * anything nested), so a card here matches a panel anywhere else in the app and
 * the density switch moves both.
 */
export default function AnalyticsSection({
  title,
  description,
  action,
  children,
  className,
  dataTest,
}) {
  return (
    <section className={cn('app-panel overflow-hidden', className)} data-test={dataTest}>
      {(title || description || action) && (
        <div className="app-card-head justify-between">
          <div className="min-w-0">
            {title ? <h3 className="app-card-title truncate">{title}</h3> : null}
            {description ? (
              <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground/75">
                {description}
              </p>
            ) : null}
          </div>
          {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
        </div>
      )}

      {children ? <div className="px-[18px] py-[15px]">{children}</div> : null}
    </section>
  );
}
