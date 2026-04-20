import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  User,
  Archive,
  FileQuestionMark,
  LayoutDashboard,
  ClipboardList,
  Building2,
  ChartNoAxesCombined,
  Settings,
  Mail,
} from "lucide-react";
import { useWorkspace, useMyWorkspaces } from "@/queries/workspaces";
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
  useSidebar,
} from "@/components/ui/sidebar";
import { useLogoutUser } from "@/queries/auth";
import { useMyInvitations } from "@/queries/invitations";
import { Avatar } from "./Avatar";
import { capitalizeFirst } from "@/helpers/capitalizeFirst";
import { useAuth } from "@/context/AuthContext";
import { useEffect } from "react";
import { Separator } from "@/components/ui/separator";

export default function AppSidebar() {
  const { user, isLoginPending } = useAuth();
  const { data: workspace } = useWorkspace(user?.workspaceId);
  const { mutate: logout } = useLogoutUser();
  const location = useLocation();
  const navigate = useNavigate();
  const { setOpenMobile, isMobile } = useSidebar();
  const { data: invitations = [] } = useMyInvitations();
  const { data: myWorkspaces = [] } = useMyWorkspaces();
  const pendingCount = invitations.length;
  const hasInvitations = pendingCount > 0;
  const hasMultipleWorkspaces = myWorkspaces.length > 1;

  useEffect(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [location.pathname, isMobile, setOpenMobile]);

  const workspaceNav = [
    {
      label: "Dashboard",
      to: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      label: "Analytics",
      to: "/analytics",
      icon: ChartNoAxesCombined,
    },
    {
      label: "Tickets",
      to: "/tickets",
      icon: ClipboardList,
    },
    {
      label: "Archive",
      to: "/admin/archive",
      icon: Archive,
    },
    {
      label: "Backlog",
      to: "/admin/backlog",
      icon: FileQuestionMark,
      adminOnly: true,
    },
    ...(user?.role === "admin" && user?.workspaceId
      ? [
          {
            label: "Workspace Management",
            to: `/admin/workspaces/${user.workspaceId}`,
            icon: Settings,
            adminOnly: true,
          },
        ]
      : []),
    ...(hasMultipleWorkspaces
      ? [
          {
            label: "My Workspaces",
            to: "/my-workspaces",
            icon: Building2,
          },
        ]
      : []),
    ...(hasInvitations
      ? [
          {
            label: "Invitations",
            to: "/invitations",
            icon: Mail,
            badge: pendingCount,
          },
        ]
      : []),
  ];

  const adminNav = [
    {
      label: "All Users",
      to: "/admin/users",
      icon: User,
    },
    {
      label: "All Workspaces",
      to: "/admin/workspaces",
      icon: Building2,
    },
  ];

  const currentWorkspaceName = workspace?.name || (user?.role === "admin" ? "Global admin mode" : null);

  return (
    <Sidebar className="border-r border-white/60 bg-white/88 backdrop-blur-xl">
      <SidebarHeader className="px-5 pt-6 pb-4">
        <div className="rounded-[1.4rem] border border-primary/10 bg-gradient-to-br from-primary/12 via-primary/5 to-white px-4 py-4 shadow-[0_16px_40px_-32px_rgba(108,105,255,0.8)]">
          <div className="text-xl font-semibold tracking-tight">
            <span className="text-foreground">Task</span>
            <span className="text-primary">Manager</span>
          </div>
          <div className="mt-2 text-xs font-medium text-muted-foreground">
            Calm control for tickets, teams, and workspaces
          </div>
        </div>
        {currentWorkspaceName && (
          <div className="mt-3 truncate px-1 text-xs font-medium text-muted-foreground">
            {currentWorkspaceName}
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="px-3 pb-2">
        {user?.workspaceId && (
          <div className="mb-4">
            <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Workspace
            </div>
            <SidebarMenu>
              {workspaceNav.map((item) => {
                if (item.adminOnly && user?.role !== "admin") {
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
                          "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all",
                          isActive
                            ? "bg-primary text-primary-foreground shadow-[0_14px_28px_-20px_rgba(108,105,255,0.95)]"
                            : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
                        )
                      }
                    >
                      <Icon className="h-4 w-4" />
                      <span className="font-medium">{item.label}</span>
                      {item.badge && (
                        <span className="ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground px-1.5">
                          {item.badge > 99 ? '99+' : item.badge}
                        </span>
                      )}
                    </NavLink>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </div>
        )}

        {user?.role === "admin" && (
          <div>
            {user?.workspaceId && <Separator className="mb-4" />}
            <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Admin
            </div>
            <SidebarMenu>
              {adminNav.map((item) => {
                const Icon = item.icon;

                return (
                  <SidebarMenuItem key={item.to}>
                    <NavLink
                      to={item.to}
                      end
                      className={({ isActive }) =>
                        cn(
                          "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all",
                          isActive
                            ? "bg-primary text-primary-foreground shadow-[0_14px_28px_-20px_rgba(108,105,255,0.95)]"
                            : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
                        )
                      }
                    >
                      <Icon className="h-4 w-4" />
                      <span className="font-medium">{item.label}</span>
                      {item.badge && (
                        <span className="ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground px-1.5">
                          {item.badge > 99 ? '99+' : item.badge}
                        </span>
                      )}
                    </NavLink>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </div>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4 pt-3">
        <div className="overflow-hidden rounded-[1.4rem] border border-white/70 bg-white/90 shadow-[0_18px_40px_-28px_rgba(76,81,191,0.35)]">
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
