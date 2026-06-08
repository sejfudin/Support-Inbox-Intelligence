import PageHeading from '@/components/PageHeading';
import { PagePanel, PageSection, PageShell } from '@/components/PageShell';
import { ReferenceDataHubsPanel } from '@/components/reference-data/ReferenceDataHubsPanel';
import { ReferenceDataInternshipTypesPanel } from '@/components/reference-data/ReferenceDataInternshipTypesPanel';
import { ReferenceDataTechnologiesPanel } from '@/components/reference-data/ReferenceDataTechnologiesPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AdminReferenceDataPage() {
  return (
    <div className="min-h-full">
      <PageShell>
        <PageSection className="space-y-6">
          <PageHeading
            kicker="Administration"
            title="Platform Management"
            subtitle="Manage hubs, internship types, and technologies used across the platform."
          />

          <PagePanel className="p-6">
            <Tabs defaultValue="hubs">
              <TabsList className="mb-6 grid w-full grid-cols-3">
                <TabsTrigger value="hubs" data-test="platform-management-hubs-tab">
                  Hubs
                </TabsTrigger>
                <TabsTrigger value="types" data-test="platform-management-internship-types-tab">
                  Internship Types
                </TabsTrigger>
                <TabsTrigger value="technologies" data-test="platform-management-technologies-tab">
                  Technologies
                </TabsTrigger>
              </TabsList>

              <TabsContent value="hubs">
                <ReferenceDataHubsPanel />
              </TabsContent>
              <TabsContent value="types">
                <ReferenceDataInternshipTypesPanel />
              </TabsContent>
              <TabsContent value="technologies">
                <ReferenceDataTechnologiesPanel />
              </TabsContent>
            </Tabs>
          </PagePanel>
        </PageSection>
      </PageShell>
    </div>
  );
}
