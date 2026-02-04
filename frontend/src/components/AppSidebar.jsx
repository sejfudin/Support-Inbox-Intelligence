import { NavLink } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";

export default function AppSidebar({ user, onSignOut }) {
  const nav = [
    {
      label: "Inbox",
      to: "/tickets",
      icon: MessageCircle,
    },
    {
      label: "Users",
      to: "/admin/users",
      icon: MessageCircle, // you can use a different icon if you want
    },
  ];

  return (
    <Sidebar>
      <SidebarHeader className="px-6 pt-6">
        <div className="text-xl font-semibold tracking-tight">
          <span className="text-foreground">Support</span>
          <span className="text-blue-600">Inbox</span>
          <span className="text-blue-600">Users</span>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3">
        <SidebarMenu>
          {nav.map((item) => {
            const Icon = item.icon;

            return (
              <SidebarMenuItem key={item.to}>
                <NavLink
                  to={item.to}
                  end
                  className={({ isActive }) =>
                    cn(
                      "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors w-full",
                      isActive
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span className="font-medium">{item.label}</span>
                </NavLink>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-semibold">
              {(user?.name?.[0] || "A").toUpperCase()}
            </div>

            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">
                {user?.name || "Alice User"}
              </div>
              <div className="text-xs text-muted-foreground">
                {user?.role || "User"}
              </div>
            </div>
          </div>

          <Button
            variant="outline"
            className="mt-4 w-full justify-start"
            onClick={onSignOut}
            type="button"
          >
            Sign out
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
