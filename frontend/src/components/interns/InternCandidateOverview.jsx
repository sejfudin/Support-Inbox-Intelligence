import { InternDocumentationLinksPanel } from '@/components/interns/InternDocumentationLinksPanel';
import { InternInternalCvPanel } from '@/components/interns/InternInternalCvPanel';
import { InternDeclaredTechnologies } from '@/components/interns/InternDeclaredTechnologies';
import { InternCvSummaryPanel } from '@/components/interns/InternCvSummaryPanel';
import { cn } from '@/lib/utils';

function OverviewSection({ title, description, children, className, action }) {
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

export function InternCandidateOverview({
  intern,
  userId,
  canEditDocumentation = false,
  canEditInternalCv = false,
  className,
}) {
  return (
    <div className={cn('space-y-4', className)}>
      <OverviewSection
        title="Declared technologies"
        description="Stacks the candidate selected on their profile."
        className="pb-4"
      >
        <InternDeclaredTechnologies technologies={intern.selfTechnologies || []} />
      </OverviewSection>

      <div className="border-t border-separator" />

      {/* Above the link panels rather than beside them: it is prose that runs the
          width of the card, and the two link panels are a matched pair that
          should not be split up to make room for it. */}
      <InternCvSummaryPanel userId={userId} cvUrl={intern.cvUrl} />

      <div className="border-t border-separator" />

      <div className="grid gap-3 md:grid-cols-2">
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
        />
      </div>
    </div>
  );
}
