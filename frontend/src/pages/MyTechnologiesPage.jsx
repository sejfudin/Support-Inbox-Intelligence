import { PageSection, PageShell } from '@/components/PageShell';
import PageHeading from '@/components/PageHeading';
import { InternPositionDeclaration } from '@/components/interns/InternPositionDeclaration';
import { InternTechnologyDeclaration } from '@/components/interns/InternTechnologyDeclaration';

const MyTechnologiesPage = () => {
  return (
    <PageShell>
      <PageSection className="space-y-6">
        <div className="mx-auto w-full max-w-3xl space-y-6">
          <PageHeading
            kicker="Internship"
            title="My Technologies"
            subtitle="Declare your main position and the technologies you are working toward. Your mentor will assess your readiness for each technology."
          />
          <InternPositionDeclaration />
          <InternTechnologyDeclaration />
        </div>
      </PageSection>
    </PageShell>
  );
};

export default MyTechnologiesPage;
