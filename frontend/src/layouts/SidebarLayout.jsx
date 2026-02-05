import { Outlet } from "react-router-dom";
import { useState } from "react";
import AppSidebar from "@/components/AppSidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import PageHeader from "@/components/PageHeader";

export default function SidebarLayout() {
  const [header, setHeader] = useState(null);

  return (
    <SidebarProvider>
      <AppSidebar />

      <SidebarInset className="min-h-screen w-full overflow-hidden">
        <div className="flex min-h-screen flex-col overflow-hidden">
          {/* Header shell - stays fixed */}
          <PageHeader>{header}</PageHeader>

          {/* Content shell */}
          <main className="flex-1 min-w-0 overflow-hidden bg-gray-50">
            <Outlet context={{ setHeader }} />
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
