import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import AppSidebar from '@/components/AppSidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import PageHeader from '@/components/PageHeader';
import { TaskManagerBrand } from '@/components/TaskManagerBrand';
import { WhatsNewTour } from '@/components/onboarding/WhatsNewTour';

export default function SidebarLayout() {
  const [header, setHeader] = useState(null);
  const hasHeader = Boolean(header);

  return (
    <SidebarProvider>
      <AppSidebar />

      <SidebarInset className="min-h-screen w-full overflow-hidden bg-transparent">
        <div className="flex min-h-screen flex-col overflow-hidden">
          {hasHeader ? (
            <PageHeader>
              <div className="flex w-full min-w-0 items-center gap-2">
                <SidebarTrigger
                  data-test="sidebar-mobile-toggle-button"
                  className="-ml-1 shrink-0 md:hidden"
                />
                <div className="min-w-0 flex-1">{header}</div>
              </div>
            </PageHeader>
          ) : (
            <>
              <PageHeader className="border-b-0 bg-transparent md:hidden">
                <div className="flex w-full items-center gap-2">
                  <SidebarTrigger
                    data-test="sidebar-mobile-toggle-button"
                    className="-ml-1 shrink-0"
                  />
                  <TaskManagerBrand size="sm" linkTo="/dashboard" className="min-w-0 flex-1" />
                </div>
              </PageHeader>
            </>
          )}

          {/* Theme, notifications and logout all live in the sidebar footer now —
              nothing floats over the page. */}
          <main
            data-tour="page-content"
            className="relative flex-1 min-w-0 overflow-hidden bg-transparent"
          >
            <Outlet context={{ setHeader }} />
          </main>
        </div>
      </SidebarInset>

      {/* Mounted inside the authenticated shell on purpose: it needs the sidebar
          rendered to anchor onto, and it must never appear over login/register. */}
      <WhatsNewTour />
    </SidebarProvider>
  );
}
