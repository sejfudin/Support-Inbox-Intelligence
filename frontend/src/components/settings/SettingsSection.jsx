import { cn } from '@/lib/utils';

/**
 * One settings card: an icon-tile header band naming the section, then rows.
 * `SettingsRow` is the row shape the band's content uses — label and hint on the
 * left, whatever changes the setting on the right — divided by hairlines.
 */
export default function SettingsSection({
  icon: Icon,
  title,
  description,
  children,
  className,
  // Anchor for the what's-new tour, which spotlights individual sections here
  // rather than the page as a whole. Explicit rather than derived from `title`, so
  // rewording a heading cannot silently unhook a tour step. See `whatsNewSteps.js`.
  tour,
}) {
  return (
    <section className={cn('app-card overflow-hidden', className)} data-tour={tour}>
      <header className="app-card-head">
        <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[var(--r-tile)] bg-primary/10 text-primary">
          <Icon className="h-[17px] w-[17px]" strokeWidth={1.8} />
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="app-card-title">{title}</span>
          {description ? (
            <span className="text-[12px] leading-[1.45] text-muted-foreground">{description}</span>
          ) : null}
        </span>
      </header>

      <div className="px-[18px]">{children}</div>
    </section>
  );
}

export function SettingsRow({ label, hint, children, className, tour }) {
  return (
    <div
      data-tour={tour}
      className={cn(
        'flex flex-col gap-3 border-b border-separator py-[13px] last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-5',
        className
      )}
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[13px] font-medium text-foreground">{label}</span>
        {hint ? (
          <span className="text-pretty text-[12px] leading-[1.45] text-muted-foreground">
            {hint}
          </span>
        ) : null}
      </span>
      {children ? <div className="shrink-0">{children}</div> : null}
    </div>
  );
}
