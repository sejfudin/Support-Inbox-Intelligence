import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { isAdmin, isMentor } from '@/helpers/roles';
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
  Database,
  GraduationCap,
  Send,
} from 'lucide-react';
import WorkspaceSwitcher from '@/components/WorkspaceSwitcher';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar';
import { useLogoutUser } from '@/queries/auth';
import { useMyInvitations } from '@/queries/invitations';
import { Avatar } from './Avatar';
import { capitalizeFirst } from '@/helpers/capitalizeFirst';
import { useAuth } from '@/context/AuthContext';
import { useCanManageActiveWorkspace } from '@/hooks/useCanManageActiveWorkspace';
import { useEffect } from 'react';
import { Separator } from '@/components/ui/separator';
import { TaskManagerBrand } from '@/components/TaskManagerBrand';

export default function AppSidebar() {
  const { user, isLoginPending } = useAuth();
  const { canManage: canManageActiveWorkspace } = useCanManageActiveWorkspace();
  const { mutate: logout } = useLogoutUser();
  const location = useLocation();
  const navigate = useNavigate();
  const { setOpenMobile, isMobile } = useSidebar();
  const { data: invitations = [] } = useMyInvitations();
  const pendingCount = invitations.length;
  const hasInvitations = pendingCount > 0;

  useEffect(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [location.pathname, isMobile, setOpenMobile]);

  const workspaceNav = [
    {
      label: 'Dashboard',
      to: '/dashboard',
      icon: LayoutDashboard,
    },
    {
      label: 'Tickets',
      to: '/tickets',
      icon: ClipboardList,
    },
    {
      label: 'Archive',
      to: '/admin/archive',
      icon: Archive,
    },
    {
      label: 'Backlog',
      to: '/admin/backlog',
      icon: FileQuestionMark,
      adminOnly: true,
    },
    {
      label: 'Analytics',
      to: '/analytics',
      icon: ChartNoAxesCombined,
    },
    ...(user?.workspaceId && canManageActiveWorkspace
      ? [
          {
            label: 'Workspace Management',
            to: `/admin/workspaces/${user.workspaceId}`,
            icon: Settings,
          },
        ]
      : []),
  ];

  const invitationNav = hasInvitations
    ? [
        {
          label: 'Invitations',
          to: '/invitations',
          icon: Mail,
          badge: pendingCount,
        },
      ]
    : [];

  const navTestSlug = (to) =>
    to
      .replace(/^\//, '')
      .replace(/\//g, '-')
      .replace(/[^a-z0-9-]/gi, '') || 'home';

  const mentorNav = isMentor(user?.role)
    ? [
        { label: 'My Interns', to: '/my-interns', icon: GraduationCap },
        { label: 'Recommendations', to: '/recommendations', icon: Send },
      ]
    : [];

  const adminNav = [
    {
      label: 'All Users',
      to: '/admin/users',
      icon: User,
    },
    {
      label: 'All Workspaces',
      to: '/admin/workspaces',
      icon: Building2,
    },
    {
      label: 'Platform Management',
      to: '/admin/platform-management',
      icon: Database,
    },
    {
      label: 'Recommendations',
      to: '/recommendations',
      icon: Send,
    },
  ];

  return (
    <Sidebar className="border-r border-border/50 bg-card shadow-elevated-sm">
      <SidebarHeader className="px-4 pb-3 pt-4">
        <div className="rounded-[1.2rem] border border-primary/10 bg-gradient-to-br from-primary/12 via-primary/5 to-card px-3 py-2.5 shadow-elevated-sm">
          <TaskManagerBrand size="md" linkTo="/dashboard" />
        </div>
        <WorkspaceSwitcher className="mt-2 py-1.5" compact />
      </SidebarHeader>

      <SidebarContent className="px-3 pb-1 md:overflow-hidden">
        {invitationNav.length > 0 && (
          <div className="mb-3">
            <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Access
            </div>
            <SidebarMenu>
              {invitationNav.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.to}>
                    <NavLink
                      to={item.to}
                      end
                      data-test={`sidebar-nav-${navTestSlug(item.to)}-link`}
                      className={({ isActive }) =>
                        cn(
                          'group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all',
                          isActive
                            ? 'bg-primary text-primary-foreground shadow-elevated-sm'
                            : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
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

        {user?.workspaceId && (
          <div className="mb-3">
            {invitationNav.length > 0 && <Separator className="mb-3" />}
            <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Workspace
            </div>
            <SidebarMenu>
              {workspaceNav.map((item) => {
                if (item.adminOnly && !isAdmin(user?.role)) {
                  return null;
                }
                const Icon = item.icon;

                return (
                  <SidebarMenuItem key={item.to}>
                    <NavLink
                      to={item.to}
                      end
                      data-test={`sidebar-nav-${navTestSlug(item.to)}-link`}
                      className={({ isActive }) =>
                        cn(
                          'group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all',
                          isActive
                            ? 'bg-primary text-primary-foreground shadow-elevated-sm'
                            : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
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

        {mentorNav.length > 0 && (
          <div className="mb-3">
            {(user?.workspaceId || invitationNav.length > 0) && <Separator className="mb-3" />}
            <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Mentoring
            </div>
            <SidebarMenu>
              {mentorNav.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.to}>
                    <NavLink
                      to={item.to}
                      end
                      data-test={`sidebar-nav-${navTestSlug(item.to)}-link`}
                      className={({ isActive }) =>
                        cn(
                          'group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all',
                          isActive
                            ? 'bg-primary text-primary-foreground shadow-elevated-sm'
                            : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
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
          </div>
        )}

        {isAdmin(user?.role) && (
          <div>
            {(user?.workspaceId || mentorNav.length > 0) && <Separator className="mb-3" />}
            <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
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
                      data-test={`sidebar-nav-${navTestSlug(item.to)}-link`}
                      className={({ isActive }) =>
                        cn(
                          'group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all',
                          isActive
                            ? 'bg-primary text-primary-foreground shadow-elevated-sm'
                            : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
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

      <SidebarFooter className="p-3 pt-2">
        <div className="overflow-hidden rounded-[1.2rem] app-elevated-sm">
          {isLoginPending ? (
            <div className="flex animate-pulse items-center gap-3 p-3">
              <div className="h-9 w-9 rounded-full bg-muted" />
              <div className="space-y-2">
                <div className="h-3 w-20 rounded bg-muted" />
                <div className="h-2 w-12 rounded bg-muted" />
              </div>
            </div>
          ) : (
            <>
              <NavLink
                to="/profile"
                end
                data-test="sidebar-nav-profile-link"
                className="block px-2 pb-2"
              >
                {({ isActive }) => (
                  <div
                    className={cn(
                      'group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-elevated-sm'
                        : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
                    )}
                  >
                    <div
                      className={cn(
                        'flex items-center justify-center rounded-full text-sm font-semibold',
                        isActive ? 'bg-primary-foreground/15' : 'bg-muted'
                      )}
                    >
                      <Avatar users={[user]} />
                    </div>

                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">
                        {user?.fullname || 'Unknown User'}
                      </div>
                      <div
                        className={cn(
                          'text-xs',
                          isActive ? 'text-primary-foreground/80' : 'text-muted-foreground'
                        )}
                      >
                        {capitalizeFirst(user?.role) || 'User'}
                      </div>
                    </div>
                  </div>
                )}
              </NavLink>

              <div className="px-3 pb-3">
                <Button
                  variant="outline"
                  data-test="sidebar-logout-button"
                  className="h-9 w-full justify-start"
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
