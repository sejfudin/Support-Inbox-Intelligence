import { cn } from '@/lib/utils';

// A titled block in the intern profile's Overview tab, with an optional control
// in the top-right. Lived inside `InternCandidateOverview` until the
// specialization section needed the same shell — importing it back out of that
// file would have made a cycle, so it sits on its own.
export function InternOverviewSection({ title, description, children, className, action }) {
  return (
    <section className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="app-card-title">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
