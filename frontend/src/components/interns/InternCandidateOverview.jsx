import { format } from 'date-fns';
import { InternDocumentationLinksPanel } from '@/components/interns/InternDocumentationLinksPanel';
import { InternInternalCvPanel } from '@/components/interns/InternInternalCvPanel';
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
  canEditInternalCv = false,
  programmeMode = 'full',
  className,
}) {
  const formattedEndDate = intern.expectedEndDate
    ? format(new Date(intern.expectedEndDate), 'MMM d, yyyy')
    : null;

  const showProgramme = programmeMode !== 'none' && programmeMode !== 'minimal';

  return (
    <div className={cn('space-y-8', className)}>
      {showProgramme && (
        <>
          <OverviewSection
            title="Programme"
            description={
              programmeMode === 'supplemental'
                ? 'Additional mentorship and timeline details.'
                : 'Mentorship assignment details.'
            }
          >
            <dl className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {programmeMode === 'full' && (
                <>
                  <DetailItem label="Primary mentor" value={intern.primaryMentor?.fullname} />
                  <DetailItem label="Secondary mentor" value={intern.secondaryMentor?.fullname} />
                </>
              )}
              {programmeMode === 'supplemental' && (
                <>
                  <DetailItem label="Secondary mentor" value={intern.secondaryMentor?.fullname} />
                  {formattedEndDate && <DetailItem label="Expected end" value={formattedEndDate} />}
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
      >
        <InternDeclaredTechnologies technologies={intern.selfTechnologies || []} />
      </OverviewSection>

      <div className="border-t border-border/60" />

      <div className="grid gap-4 md:grid-cols-2">
        <InternInternalCvPanel
          userId={userId}
          internalCvUrl={intern.internalCvUrl}
          internName={intern.user?.fullname}
          canEdit={canEditInternalCv}
        />
        <InternDocumentationLinksPanel
          userId={userId}
          links={intern.documentationLinks || []}
          canEdit={canEditDocumentation}
          className="rounded-2xl border border-border/60 p-5"
        />
      </div>
    </div>
  );
}
