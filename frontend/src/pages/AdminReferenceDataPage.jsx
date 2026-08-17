import PageHeading from '@/components/PageHeading';
import { ReferenceDataHubsPanel } from '@/components/reference-data/ReferenceDataHubsPanel';
import { ReferenceDataInternshipTypesPanel } from '@/components/reference-data/ReferenceDataInternshipTypesPanel';
import { ReferenceDataPositionsPanel } from '@/components/reference-data/ReferenceDataPositionsPanel';
import { ReferenceDataProjectsPanel } from '@/components/reference-data/ReferenceDataProjectsPanel';
import { ReferenceDataTechnologiesPanel } from '@/components/reference-data/ReferenceDataTechnologiesPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// The same underline tab as the analytics page, the admin attendance page and
// the intern profile: these switch between five separate lists rather than
// filtering one, so a pill row would read as a filter set.
const tabTriggerClass =
  'mx-2.5 h-11 shrink-0 rounded-none border-0 bg-transparent px-1 text-[13px] font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-[inset_0_-2px_0_hsl(var(--primary))]';

export default function AdminReferenceDataPage() {
  return (
    <div className="app-page">
      {/* `pb-0`, not `py-0`: `.app-page-header`'s -24px top margin is the exact
          counterpart of this container's top padding, so the padding has to be
          there for the header to land flush against the top of the content area
          rather than 24px above it. The bottom gutter is the tab body's below. */}
      <div className="app-page-content pb-0">
        <PageHeading
          crumb="Admin"
          title="Platform management"
          subtitle="Hubs, internship types, positions, technologies and projects used across the platform."
        />

        <Tabs defaultValue="hubs">
          {/* The tab band: bleeds the page gutter, then pads it back to the same
              48px the cards below sit at, so the first tab lines up with the
              card edge. Sits flush
              under the header, so the two bands read as one strip of chrome.
              The tabs used to live inside a card below the header, which put a
              rounded panel around what is really the page's own navigation. */}
          <div className="-mx-6 border-b border-separator bg-card px-6">
            <TabsList
              className="-mx-2.5 flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-none bg-transparent p-0"
              data-test="platform-management-tabs"
            >
              <TabsTrigger
                value="hubs"
                className={tabTriggerClass}
                data-test="platform-management-hubs-tab"
              >
                Hubs
              </TabsTrigger>
              <TabsTrigger
                value="types"
                className={tabTriggerClass}
                data-test="platform-management-internship-types-tab"
              >
                Internship types
              </TabsTrigger>
              <TabsTrigger
                value="positions"
                className={tabTriggerClass}
                data-test="platform-management-positions-tab"
              >
                Positions
              </TabsTrigger>
              <TabsTrigger
                value="technologies"
                className={tabTriggerClass}
                data-test="platform-management-technologies-tab"
              >
                Technologies
              </TabsTrigger>
              <TabsTrigger
                value="projects"
                className={tabTriggerClass}
                data-test="platform-management-projects-tab"
              >
                Projects
              </TabsTrigger>
            </TabsList>
          </div>

          {/* 18px rather than `.app-page-content`'s 24px — the band above closes
              with its own hairline, so the panels start against that. */}
          <div className="pb-8 pt-[18px]">
            <TabsContent value="hubs" className="mt-0">
              <ReferenceDataHubsPanel />
            </TabsContent>
            <TabsContent value="types" className="mt-0">
              <ReferenceDataInternshipTypesPanel />
            </TabsContent>
            <TabsContent value="positions" className="mt-0">
              <ReferenceDataPositionsPanel />
            </TabsContent>
            <TabsContent value="technologies" className="mt-0">
              <ReferenceDataTechnologiesPanel />
            </TabsContent>
            <TabsContent value="projects" className="mt-0">
              <ReferenceDataProjectsPanel />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
