import { format } from 'date-fns';
import { InternDocumentationLinksPanel } from '@/components/interns/InternDocumentationLinksPanel';
import { InternCvLink } from '@/components/interns/InternCvLink';
import { InternDeclaredTechnologies } from '@/components/interns/InternDeclaredTechnologies';
import { cn } from '@/lib/utils';

function OverviewSection({ title, description, children, className, action }) {
  return (
    <section className={cn('space-y-4', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function DetailItem({ label, value }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{value || '—'}</dd>
    </div>
  );
}

export function InternCandidateOverview({
  intern,
  userId,
  canEditDocumentation = false,
  programmeMode = 'full',
  className,
}) {
  const formattedEndDate = intern.expectedEndDate
    ? format(new Date(intern.expectedEndDate), 'MMM d, yyyy')
    : '—';

  const showProgramme = programmeMode !== 'none' && programmeMode !== 'minimal';

  return (
    <div className={cn('space-y-8', className)}>
      {programmeMode === 'minimal' && (
        <>
          <OverviewSection title="Programme" description="Additional mentorship details.">
            <dl className="grid gap-6 sm:grid-cols-2">
              <DetailItem label="Secondary mentor" value={intern.secondaryMentor?.fullname} />
              <DetailItem
                label="Expected end"
                value={
                  intern.expectedEndDate
                    ? format(new Date(intern.expectedEndDate), 'MMM d, yyyy')
                    : '—'
                }
              />
            </dl>
          </OverviewSection>
          <div className="border-t border-border/60" />
        </>
      )}

      {showProgramme && (
        <>
          <OverviewSection
            title="Programme"
            description={
              programmeMode === 'supplemental'
                ? 'Additional mentorship and timeline details.'
                : 'Mentorship assignment and placement readiness.'
            }
          >
            <dl className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {programmeMode === 'full' && (
                <>
                  <DetailItem label="Primary mentor" value={intern.primaryMentor?.fullname} />
                  <DetailItem label="Secondary mentor" value={intern.secondaryMentor?.fullname} />
                  {intern.readyForPlacement !== undefined && (
                    <DetailItem
                      label="Ready for placement"
                      value={intern.readyForPlacement ? 'Yes' : 'No'}
                    />
                  )}
                </>
              )}
              {programmeMode === 'supplemental' && (
                <>
                  <DetailItem label="Secondary mentor" value={intern.secondaryMentor?.fullname} />
                  <DetailItem label="Expected end" value={formattedEndDate} />
                </>
              )}
            </dl>
          </OverviewSection>
          <div className="border-t border-border/60" />
        </>
      )}

      <OverviewSection
        title="Declared technologies"
        description="Stacks the candidate selected on their profile."
        action={
          <InternCvLink cvUrl={intern.cvUrl} showEmptyState testId="intern-overview-cv-link" />
        }
      >
        <InternDeclaredTechnologies technologies={intern.selfTechnologies || []} />
      </OverviewSection>

      <div className="border-t border-border/60" />

      <InternDocumentationLinksPanel
        userId={userId}
        links={intern.documentationLinks || []}
        canEdit={canEditDocumentation}
      />
    </div>
  );
}
