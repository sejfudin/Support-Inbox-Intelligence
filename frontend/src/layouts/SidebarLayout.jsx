import { Outlet } from "react-router-dom";
import { useState } from "react";
import AppSidebar from "@/components/AppSidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import PageHeader from "@/components/PageHeader";
import NavbarNotifications from "@/components/NavbarNotifications";

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
                <SidebarTrigger className="-ml-1 shrink-0 md:hidden" />
                <div className="min-w-0 flex-1">{header}</div>
              </div>
            </PageHeader>
          ) : (
            <>
              <PageHeader className="border-b-0 bg-transparent md:hidden">
                <div className="flex w-full items-center gap-2">
                  <SidebarTrigger className="-ml-1 shrink-0" />
                </div>
              </PageHeader>
            </>
          )}

          <main className="app-with-floating-notifications relative flex-1 min-w-0 overflow-hidden bg-transparent">
            <div className="pointer-events-none absolute inset-x-0 top-6 z-30">
              <div className="mx-auto flex w-full max-w-7xl justify-end px-4 sm:px-6 lg:px-8">
                <div className="pointer-events-auto md:translate-x-12 lg:translate-x-14">
                  <NavbarNotifications />
                </div>
              </div>
            </div>
            <Outlet context={{ setHeader }} />
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
