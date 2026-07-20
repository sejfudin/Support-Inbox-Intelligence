import PageHeading from '@/components/PageHeading';
import { PagePanel, PageSection, PageShell } from '@/components/PageShell';
import { ReferenceDataHubsPanel } from '@/components/reference-data/ReferenceDataHubsPanel';
import { ReferenceDataInternshipTypesPanel } from '@/components/reference-data/ReferenceDataInternshipTypesPanel';
import { ReferenceDataProjectsPanel } from '@/components/reference-data/ReferenceDataProjectsPanel';
import { ReferenceDataTechnologiesPanel } from '@/components/reference-data/ReferenceDataTechnologiesPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const platformTabTriggerClass =
  '-mb-[2px] w-full rounded-none border-b-2 border-transparent bg-transparent px-0 pb-4 pt-0 text-center text-sm font-medium text-muted-foreground shadow-none transition-colors hover:border-border hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:hover:border-primary';

export default function AdminReferenceDataPage() {
  return (
    <div className="min-h-full">
      <PageShell>
        <PageSection className="space-y-6">
          <PageHeading
            kicker="Administration"
            title="Platform Management"
            subtitle="Manage hubs, internship types, technologies, and projects used across the platform."
          />

          <PagePanel className="p-6">
            <Tabs defaultValue="hubs">
              <TabsList className="mb-8 grid h-auto w-full grid-cols-4 rounded-none border-b border-border bg-transparent p-0">
                <TabsTrigger
                  value="hubs"
                  className={platformTabTriggerClass}
                  data-test="platform-management-hubs-tab"
                >
                  Hubs
                </TabsTrigger>
                <TabsTrigger
                  value="types"
                  className={platformTabTriggerClass}
                  data-test="platform-management-internship-types-tab"
                >
                  Internship Types
                </TabsTrigger>
                <TabsTrigger
                  value="technologies"
                  className={platformTabTriggerClass}
                  data-test="platform-management-technologies-tab"
                >
                  Technologies
                </TabsTrigger>
                <TabsTrigger
                  value="projects"
                  className={platformTabTriggerClass}
                  data-test="platform-management-projects-tab"
                >
                  Projects
                </TabsTrigger>
              </TabsList>

              <TabsContent value="hubs" className="mt-0">
                <ReferenceDataHubsPanel />
              </TabsContent>
              <TabsContent value="types" className="mt-0">
                <ReferenceDataInternshipTypesPanel />
              </TabsContent>
              <TabsContent value="technologies" className="mt-0">
                <ReferenceDataTechnologiesPanel />
              </TabsContent>
              <TabsContent value="projects" className="mt-0">
                <ReferenceDataProjectsPanel />
              </TabsContent>
            </Tabs>
          </PagePanel>
        </PageSection>
      </PageShell>
    </div>
  );
}
