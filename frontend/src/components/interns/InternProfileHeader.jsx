import { SymphonyStatusBadge } from '@/components/symphony/SymphonyStatusBadge';
import { getInitials } from '@/helpers/getInitials';
import { CHIP } from '@/helpers/badgeTones';
import { cn } from '@/lib/utils';

function MetaField({ label, value }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="app-crumb">{label}</dt>
      <dd className="truncate text-[13px] font-medium text-foreground">{value || '—'}</dd>
    </div>
  );
}

/**
 * The intern profile's identity band: back link, who this is, the four programme
 * facts, and the tab strip that switches the body below.
 *
 * A flat band rather than a card, bleeding out of `.app-page-content`'s 48px
 * gutter the same way `.app-page-header` does — it is this page's page header, and
 * the tab strip has to be part of it so the tabs read as belonging to the person
 * rather than floating above the content. `tabs` is a slot for exactly that: the
 * `Tabs` root has to wrap both the strip and the panels, so it stays in
 * `InternProfileView` and the strip is passed down.
 */
export function InternProfileHeader({
  fullname,
  email,
  status,
  declaredPosition,
  programme,
  hub,
  startDate,
  primaryMentor,
  secondaryMentor,
  backButton,
  titleAdornment,
  tabs,
  className,
}) {
  return (
    <div className={cn('-mx-6 -mt-6 border-b border-border bg-card px-6 pt-[14px]', className)}>
      {backButton}

      <div className="flex flex-wrap items-start gap-3.5 pb-3.5 pt-3">
        {/* A tint block, not the inverted foreground square: at 52px a solid dark
            slab is the heaviest thing on the page, and the person's name should
            win that contest. `accent-ink` is what keeps 16px initials legible on
            the tint — see `index.css`. */}
        <span
          className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[var(--r-card)] bg-primary/10 text-[16px] font-bold accent-ink"
          aria-hidden="true"
        >
          {getInitials(fullname || '')}
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="app-title break-words">{fullname || 'Intern'}</h1>
            {declaredPosition ? (
              <span className={cn(CHIP, 'bg-primary/10 accent-ink')}>{declaredPosition}</span>
            ) : null}
            {status ? (
              <SymphonyStatusBadge status={status} className={cn(CHIP, 'gap-1.5 border-0')} />
            ) : null}
          </div>
          {email ? <p className="app-subtitle">{email}</p> : null}
        </div>

        {titleAdornment ? (
          <div className="flex shrink-0 items-center gap-2">{titleAdornment}</div>
        ) : null}
      </div>

      <dl
        className={cn(
          'grid grid-cols-2 gap-3 pb-3.5 sm:grid-cols-4',
          secondaryMentor && 'sm:grid-cols-5'
        )}
      >
        <MetaField label="Programme" value={programme} />
        <MetaField label="Hub" value={hub} />
        <MetaField label="Start date" value={startDate} />
        <MetaField label="Primary mentor" value={primaryMentor} />
        {secondaryMentor ? <MetaField label="Secondary mentor" value={secondaryMentor} /> : null}
      </dl>

      {tabs}
    </div>
  );
}
