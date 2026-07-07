import { PageSection, PageShell } from '@/components/PageShell';
import PageHeading from '@/components/PageHeading';
import { InternTechnologyDeclaration } from '@/components/interns/InternTechnologyDeclaration';

const MyTechnologiesPage = () => {
  return (
    <PageShell>
      <PageSection className="space-y-6">
        <div className="mx-auto w-full max-w-3xl space-y-6">
          <PageHeading
            kicker="Internship"
            title="My Technologies"
            subtitle="Declare the technologies you are working toward. Your mentor will assess your readiness for each."
          />
          <InternTechnologyDeclaration />
        </div>
      </PageSection>
    </PageShell>
  );
};

export default MyTechnologiesPage;
