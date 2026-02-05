import { NavLink, useNavigate } from "react-router-dom";
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
import {  useLogoutUser } from "@/queries/auth";
import { Avatar } from "./Avatar";
import { capitalizeFirst } from "@/helpers/capitalizeFirst";
import { useAuth } from "@/context/AuthContext";

export default function AppSidebar({  onSignOut }) {
  const { user, isLoginPending } = useAuth();
  const { mutate: logout } = useLogoutUser();

  const nav = [
    {
      label: "Inbox",
      to: "/tickets",
      icon: MessageCircle,
    },{
      label: "Users",
      to: "/admin/users",
      icon: MessageCircle,
      adminOnly: true,
    }
  ];
  
  
  const navigate=useNavigate();
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
            if (item.adminOnly && user?.role !== 'admin') {
                return null;
            }
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
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          {isLoginPending ? (
            <div className="p-4 flex items-center gap-3 animate-pulse">
              <div className="h-9 w-9 rounded-full bg-muted" />
              <div className="space-y-2">
                <div className="h-3 w-20 rounded bg-muted" />
                <div className="h-2 w-12 rounded bg-muted" />
              </div>
            </div>
          ) : (
            <>
              <div 
                onClick={() => navigate("/profile")}
                className="p-4 flex items-center gap-3 cursor-pointer transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center justify-center rounded-full bg-muted text-sm font-semibold">
                  <Avatar users={[user]} />
                </div>

                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">
                    {user?.fullname || "Unknown User"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {capitalizeFirst(user?.role) || "User"}
                  </div>
                </div>
              </div>

              <div className="px-4 pb-4">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={(e) => {
                    e.stopPropagation();
                    logout();
                  }}
                  type="button"
                >
                  Logout
                </Button>
              </div>
            </>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
