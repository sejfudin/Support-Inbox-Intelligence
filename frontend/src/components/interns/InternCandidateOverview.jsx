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

export function InternCandidateOverview({
  intern,
  userId,
  canEditDocumentation = false,
  canEditInternalCv = false,
  className,
}) {
  return (
    <div className={cn('space-y-8', className)}>
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
