import { Outlet } from 'react-router-dom';
import AppSidebar from '@/components/AppSidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { WhatsNewTour } from '@/components/onboarding/WhatsNewTour';

export default function SidebarLayout() {
  return (
    <SidebarProvider>
      <AppSidebar />

      <SidebarInset className="min-h-screen w-full overflow-hidden bg-transparent">
        <div className="flex min-h-screen flex-col overflow-hidden">
          {/* The sidebar is off-canvas on mobile, so this is its only reopen handle
              once the top bar is gone. Desktop uses the collapse toggle in the
              sidebar header instead. */}
          <SidebarTrigger
            data-test="sidebar-mobile-toggle-button"
            className="absolute left-3 top-3 z-20 md:hidden"
          />

          <main
            data-tour="page-content"
            className="relative flex-1 min-w-0 overflow-hidden bg-transparent"
          >
            <Outlet />
          </main>
        </div>
      </SidebarInset>

      {/* Mounted inside the authenticated shell on purpose: it needs the sidebar
          rendered to anchor onto, and it must never appear over login/register. */}
      <WhatsNewTour />
    </SidebarProvider>
  );
}
