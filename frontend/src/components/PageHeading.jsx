import { cn } from '@/lib/utils';

export default function PageHeading({
  kicker,
  title,
  subtitle,
  actions,
  titleAdornment,
  meta,
  showMetaDivider = false,
  beforeKicker,
  children,
  className,
}) {
  return (
    <div className={cn('app-panel px-5 py-5 md:px-6', className)}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          {beforeKicker ? <div className="mb-3">{beforeKicker}</div> : null}
          {kicker ? <div className="app-kicker mb-3">{kicker}</div> : null}
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="app-title break-words">{title}</h1>
            {titleAdornment}
          </div>
          {subtitle ? <p className="app-subtitle">{subtitle}</p> : null}
          {meta ? (
            <div className={cn('mt-4', showMetaDivider && 'border-t border-border/60 pt-4')}>
              {meta}
            </div>
          ) : null}
        </div>

        {actions ? (
          <div className="flex w-full flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center md:w-auto md:justify-end">
            {actions}
          </div>
        ) : null}
      </div>

      {children ? <div className="mt-4 border-t border-border/60 pt-4">{children}</div> : null}
    </div>
  );
}
