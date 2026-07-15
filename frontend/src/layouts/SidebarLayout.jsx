import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import AppSidebar from '@/components/AppSidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import PageHeader from '@/components/PageHeader';
import AppTopActions from '@/components/AppTopActions';
import { TaskManagerBrand } from '@/components/TaskManagerBrand';

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

          <main className="relative flex-1 min-w-0 overflow-hidden bg-transparent">
            <div className="pointer-events-none fixed right-4 top-4 z-40 sm:right-6 sm:top-6">
              <div className="pointer-events-auto">
                <AppTopActions />
              </div>
            </div>
            <Outlet context={{ setHeader }} />
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
