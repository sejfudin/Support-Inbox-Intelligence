import { cloneElement, isValidElement } from 'react';
import { Pencil } from 'lucide-react';
import { SymphonyStatusBadge } from '@/components/symphony/SymphonyStatusBadge';
import { cn } from '@/lib/utils';

function MetaField({ label, value, className }) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 truncate text-sm font-semibold text-foreground">{value || '—'}</dd>
    </div>
  );
}

export function InternProfileHeader({
  kicker,
  fullname,
  email,
  status,
  programme,
  hub,
  startDate,
  primaryMentor,
  secondaryMentor,
  backButton,
  titleAdornment,
  className,
}) {
  const editAction =
    titleAdornment && isValidElement(titleAdornment)
      ? cloneElement(titleAdornment, {
          variant: 'ghost',
          size: 'icon',
          className: cn(
            'h-8 w-8 shrink-0 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground',
            titleAdornment.props.className
          ),
          'aria-label': 'Edit user',
          title: 'Edit user',
          children: <Pencil className="h-4 w-4" aria-hidden="true" />,
        })
      : titleAdornment;

  return (
    <header className={cn('app-panel overflow-hidden', className)}>
      <div className="px-5 py-5 md:px-6 md:py-6">
        {backButton ? <div className="mb-4">{backButton}</div> : null}

        {kicker ? <p className="app-kicker mb-2">{kicker}</p> : null}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="app-title break-words">{fullname || 'Intern'}</h1>
              {editAction}
            </div>
            {email ? <p className="app-subtitle mt-1">{email}</p> : null}
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            {status ? <SymphonyStatusBadge status={status} /> : null}
          </div>
        </div>
      </div>

      <dl
        className={cn(
          'grid grid-cols-2 gap-4 border-t border-border/60 bg-muted/20 px-5 py-4 md:grid-cols-4 md:px-6',
          secondaryMentor && 'md:grid-cols-5'
        )}
      >
        <MetaField label="Programme" value={programme} />
        <MetaField label="Hub" value={hub} />
        <MetaField label="Start date" value={startDate} />
        <MetaField label="Primary mentor" value={primaryMentor} />
        {secondaryMentor ? <MetaField label="Secondary mentor" value={secondaryMentor} /> : null}
      </dl>
    </header>
  );
}
