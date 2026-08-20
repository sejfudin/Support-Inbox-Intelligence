import { cn } from '@/lib/utils';

/**
 * The analytics mockup's chart card: 12px radius, one outline, `14px 16px 12px`
 * of padding, and a 13.5px title over an 11.5px subtitle. Every panel on the page
 * uses it, which is what makes the three rows read as one grid rather than as a
 * stack of differently-built cards.
 */
export default function AnalyticsSection({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
  dataTest,
}) {
  return (
    <section
      className={cn(
        'rounded-[var(--r-card)] border border-border bg-card px-4 pb-3 pt-3.5',
        className
      )}
      data-test={dataTest}
    >
      {title || action ? (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[13.5px] font-semibold leading-tight text-foreground">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-[11.5px] text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {action ? <div className="flex-none">{action}</div> : null}
        </div>
      ) : null}
      <div className={cn(title ? 'mt-3.5' : null, bodyClassName)}>{children}</div>
    </section>
  );
}
