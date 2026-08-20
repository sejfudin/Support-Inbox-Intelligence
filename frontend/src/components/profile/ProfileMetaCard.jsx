import { cn } from '@/lib/utils';

/**
 * A read-only label → value card, as the profile page's right-hand column uses
 * it twice: the internship programme and the account itself.
 *
 * Rows are a list, not a grid. The values are short and the column is narrow, so
 * label-left / value-right down a single hairline-divided stack stays scannable
 * where a two-up grid would wrap "Secondary mentor" onto its own line and leave
 * a hole beside it.
 *
 * `value` takes a node so a row can carry a badge, and falls back to an em dash
 * for anything unset — a blank right edge reads as a rendering bug.
 */
export function ProfileMetaCard({ title, description, rows = [], className, dataTest }) {
  return (
    <section className={cn('app-card overflow-hidden', className)} data-test={dataTest}>
      <div className="border-b border-separator px-[18px] py-[13px]">
        <h2 className="app-card-title">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-[12.5px] leading-[1.45] text-muted-foreground">{description}</p>
        ) : null}
      </div>

      <dl className="px-[18px]">
        {rows.map(({ label, value }) => (
          <div
            key={label}
            className="flex items-center justify-between gap-3 border-b border-separator py-[11px] last:border-0"
          >
            <dt className="shrink-0 text-[12.5px] text-muted-foreground">{label}</dt>
            <dd className="min-w-0 truncate text-right text-[12.5px] font-medium text-foreground">
              {value ?? '—'}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
