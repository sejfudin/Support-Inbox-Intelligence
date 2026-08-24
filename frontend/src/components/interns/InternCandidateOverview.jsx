import { InternDocumentationLinksPanel } from '@/components/interns/InternDocumentationLinksPanel';
import { InternInternalCvPanel } from '@/components/interns/InternInternalCvPanel';
import { InternDeclaredTechnologies } from '@/components/interns/InternDeclaredTechnologies';
import { InternCvSummaryPanel } from '@/components/interns/InternCvSummaryPanel';
import { InternOverviewSection } from '@/components/interns/InternOverviewSection';
import { InternSpecializationPanel } from '@/components/interns/InternSpecializationPanel';
import { cn } from '@/lib/utils';

export function InternCandidateOverview({
  intern,
  userId,
  canEditDocumentation = false,
  canEditInternalCv = false,
  canGenerateCvSummary = false,
  canManageSpecialization = false,
  className,
}) {
  return (
    <div className={cn('space-y-4', className)}>
      {/* First, and only for an admin: it is the one section here carrying a
          write action, and the programme decision the rest of the profile hangs
          off. Mentors read the pairing from the header band instead. */}
      {canManageSpecialization && (
        <>
          <InternSpecializationPanel intern={intern} className="pb-4" />
          <div className="border-t border-separator" />
        </>
      )}

      <InternOverviewSection
        title="Declared technologies"
        description="Stacks the candidate selected on their profile."
        className="pb-4"
      >
        <InternDeclaredTechnologies technologies={intern.selfTechnologies || []} />
      </InternOverviewSection>

      <div className="border-t border-separator" />

      {/* Above the link panels rather than beside them: it is prose that runs the
          width of the card, and the two link panels are a matched pair that
          should not be split up to make room for it. */}
      <InternCvSummaryPanel
        userId={userId}
        cvUrl={intern.cvUrl}
        canGenerate={canGenerateCvSummary}
      />

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
