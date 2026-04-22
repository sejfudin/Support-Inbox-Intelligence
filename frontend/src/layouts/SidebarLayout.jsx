import { Outlet } from "react-router-dom";
import { useState } from "react";
import AppSidebar from "@/components/AppSidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import PageHeader from "@/components/PageHeader";
import NavbarNotifications from "@/components/NavbarNotifications";
import { useAuth } from "@/context/AuthContext";

export default function SidebarLayout() {
  const [header, setHeader] = useState(null);
  const hasHeader = Boolean(header);
  const { isAuthenticated } = useAuth();

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
                {isAuthenticated ? (
                  <div className="ml-auto shrink-0">
                    <NavbarNotifications />
                  </div>
                ) : null}
              </div>
            </PageHeader>
          ) : (
            <>
              <PageHeader className="border-b-0 bg-transparent md:hidden">
                <div className="flex w-full items-center gap-2">
                  <SidebarTrigger className="-ml-1 shrink-0" />
                  <div className="ml-auto shrink-0">
                    {isAuthenticated ? <NavbarNotifications /> : null}
                  </div>
                </div>
              </PageHeader>
              <PageHeader className="sticky top-0 z-20 hidden shrink-0 border-b border-white/60 bg-white/80 md:flex">
                <div className="flex w-full items-center justify-end px-4 sm:px-6 lg:px-8">
                  {isAuthenticated ? <NavbarNotifications /> : null}
                </div>
              </PageHeader>
            </>
          )}

          {/* Content shell */}
          <main className="flex-1 min-w-0 overflow-hidden bg-transparent">
            <Outlet context={{ setHeader }} />
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
