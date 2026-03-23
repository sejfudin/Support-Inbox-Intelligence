import { Outlet } from "react-router-dom";
import { useState } from "react";
import AppSidebar from "@/components/AppSidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import PageHeader from "@/components/PageHeader";

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
              <SidebarTrigger className="-ml-1 md:hidden" />
              {header}
            </PageHeader>
          ) : (
            <PageHeader className="border-b-0 bg-transparent backdrop-blur-0 md:hidden">
              <SidebarTrigger className="-ml-1" />
            </PageHeader>
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
