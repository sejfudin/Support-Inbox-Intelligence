import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import AppSidebar from '@/components/AppSidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import PageHeader from '@/components/PageHeader';
import NavbarNotifications from '@/components/NavbarNotifications';
import { WhatsNewTour } from '@/components/onboarding/WhatsNewTour';

export default function SidebarLayout() {
  const [header, setHeader] = useState(null);
  const hasHeader = Boolean(header);

  return (
    <SidebarProvider>
      <AppSidebar />

      <SidebarInset className="min-h-screen w-full overflow-hidden bg-transparent">
        <div className="flex min-h-screen flex-col overflow-hidden">
          {/* Always rendered — the bell needs one consistent top-right home on
              every page. Most pages set no header content of their own, so the
              bar shrinks to just the bell (compact) instead of stretching a
              mostly-empty full-size strip across the top. */}
          <PageHeader compact={!hasHeader}>
            <div className="flex w-full min-w-0 items-center gap-2">
              <SidebarTrigger
                data-test="sidebar-mobile-toggle-button"
                className="-ml-1 shrink-0 md:hidden"
              />
              {hasHeader ? <div className="min-w-0 flex-1">{header}</div> : null}
              <div className="ml-auto shrink-0" data-tour="notifications">
                <NavbarNotifications />
              </div>
            </div>
          </PageHeader>

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
