import { NavLink, useLocation, useMatch } from 'react-router-dom';
import { isAdmin, isMentor, isIntern } from '@/helpers/roles';
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
  Code2,
  CalendarCheck,
  CalendarDays,
  CalendarClock,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronsUpDown,
  UserRound,
} from 'lucide-react';
import WorkspaceSwitcher from '@/components/WorkspaceSwitcher';
import NavbarNotifications from '@/components/NavbarNotifications';
import { ThemeAppearanceSubmenu } from '@/components/ThemeSwitcher';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useLogoutUser } from '@/queries/auth';
import { useMyInvitations } from '@/queries/invitations';
import { Avatar } from './Avatar';
import { capitalizeFirst } from '@/helpers/capitalizeFirst';
import { useAuth } from '@/context/AuthContext';
import { useCanManageActiveWorkspace } from '@/hooks/useCanManageActiveWorkspace';
import { useEffect } from 'react';
import { Separator } from '@/components/ui/separator';
import { TaskManagerBrand } from '@/components/TaskManagerBrand';

// Shared easing for every rail affordance so the width slide, the label
// crossfade, and the row reflow all move on the same curve. easeInOutCubic —
// gentle acceleration and deceleration at both ends so the motion reads as
// smooth rather than snapping away at the start.
const RAIL_EASE = 'ease-[cubic-bezier(0.65,0,0.35,1)]';

// A label that lives inside a rail row. Collapsing the sidebar fades it out AND
// squeezes its width to 0 so the row's icon reflows to center in sync with the
// panel slide — swapping to `display:none` instead would snap the text away at
// frame 0 while the box was still animating.
// `max-w-[12rem]` (not `none`) gives the width transition an explicit start
// length so it animates to `max-w-0` instead of snapping — a length is required
// at both ends. 12rem clears the widest rail label with room to spare.
const collapsibleLabel = `max-w-[12rem] overflow-hidden opacity-100 transition-[max-width,opacity] duration-300 ${RAIL_EASE} group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:opacity-0`;

const navTestSlug = (to) =>
  to
    .replace(/^\//, '')
    .replace(/\//g, '-')
    .replace(/[^a-z0-9-]/gi, '') || 'home';

/**
 * Collapsed-rail tooltip: wraps a rail control so its label appears to the
 * right. Centralizes the `side="right"` convention every rail affordance shares.
 */
function RailTooltip({ label, children }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * One nav row. Collapsed (icon rail) it shrinks to a centred icon and the label
 * moves into a tooltip — the label crossfades to zero width (see
 * `collapsibleLabel`) rather than unmounting, so it animates in step with the
 * panel slide instead of snapping away.
 *
 * Active state comes from `useMatch`, NOT NavLink's `className` callback, because
 * in the rail this link is a `TooltipTrigger asChild`: Radix's Slot merges
 * className with `[slot, child].filter(Boolean).join(' ')`, which stringifies a
 * className *function* into its own source code and silently drops every real
 * class. That wiped the layout classes in the collapsed state only.
 */
function NavItem({ item, collapsed }) {
  const Icon = item.icon;
  const isActive = Boolean(useMatch({ path: item.to, end: true }));

  const link = (
    <NavLink
      to={item.to}
      end
      data-test={`sidebar-nav-${navTestSlug(item.to)}-link`}
      className={cn(
        `flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all duration-300 ${RAIL_EASE}`,
        'group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:px-0',
        isActive
          ? 'bg-primary text-primary-foreground shadow-elevated-sm'
          : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className={cn('min-w-0 flex-1 truncate font-medium', collapsibleLabel)}>
        {item.label}
      </span>
      {item.badge ? (
        <span
          className={cn(
            'ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground group-data-[collapsible=icon]:min-w-0',
            collapsibleLabel
          )}
        >
          {item.badge > 99 ? '99+' : item.badge}
        </span>
      ) : null}
    </NavLink>
  );

  if (!collapsed) return link;

  return (
    <RailTooltip label={`${item.label}${item.badge ? ` (${item.badge})` : ''}`}>{link}</RailTooltip>
  );
}

/**
 * A titled group of nav rows. In the rail the title would have nothing to sit
 * next to, so it is replaced by the leading separator the mockup shows.
 */
function NavGroup({ title, items, collapsed, showSeparator, className }) {
  const visible = items.filter((item) => !item.hidden);
  if (visible.length === 0) return null;

  return (
    <div className={className}>
      {showSeparator && <Separator className="mb-3" />}
      <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground group-data-[collapsible=icon]:hidden">
        {title}
      </div>
      <SidebarMenu className="group-data-[collapsible=icon]:items-center">
        {visible.map((item) => (
          <SidebarMenuItem key={item.to}>
            <NavItem item={item} collapsed={collapsed} />
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </div>
  );
}

export default function AppSidebar() {
  const { user, isLoginPending } = useAuth();
  const { canManage: canManageActiveWorkspace } = useCanManageActiveWorkspace();
  const { mutate: logout } = useLogoutUser();
  const location = useLocation();
  const { setOpenMobile, isMobile, state, toggleSidebar } = useSidebar();
  const { data: invitations = [] } = useMyInvitations();
  const pendingCount = invitations.length;

  // Tooltips replace labels only in the desktop rail — the mobile sheet always
  // shows the full-width sidebar, so it must keep its labels.
  const collapsed = state === 'collapsed' && !isMobile;

  useEffect(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [location.pathname, isMobile, setOpenMobile]);

  const workspaceNav = [
    { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
    { label: 'Tickets', to: '/tickets', icon: ClipboardList },
    { label: 'Archive', to: '/archive', icon: Archive },
    {
      label: 'Backlog',
      to: '/backlog',
      icon: FileQuestionMark,
      hidden: !(isAdmin(user?.role) || isMentor(user?.role) || isIntern(user?.role)),
    },
    { label: 'Analytics', to: '/analytics', icon: ChartNoAxesCombined },
    { label: 'Dailies', to: '/dailies', icon: CalendarDays },
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

  const invitationNav =
    pendingCount > 0
      ? [{ label: 'Invitations', to: '/invitations', icon: Mail, badge: pendingCount }]
      : [];

  const mentorNav = isMentor(user?.role)
    ? [
        { label: 'My Interns', to: '/my-interns', icon: GraduationCap },
        { label: 'My Workspaces', to: '/workspaces', icon: Building2 },
      ]
    : [];

  const internNav = isIntern(user?.role)
    ? [
        { label: 'Position & Technologies', to: '/my-technologies', icon: Code2 },
        { label: 'Attendance', to: '/my-attendance', icon: CalendarCheck },
      ]
    : [];

  const adminNav = isAdmin(user?.role)
    ? [
        { label: 'All Users', to: '/admin/users', icon: User },
        { label: 'All Workspaces', to: '/admin/workspaces', icon: Building2 },
        { label: 'Attendance', to: '/attendance', icon: CalendarCheck },
        { label: 'Daily Insights', to: '/admin/daily-insights', icon: CalendarClock },
        { label: 'Platform Management', to: '/admin/platform-management', icon: Database },
        { label: 'Recommendations', to: '/recommendations', icon: Send },
      ]
    : [];

  const hasWorkspaceNav = Boolean(user?.workspaceId);
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <Sidebar collapsible="icon" className="border-r border-border/50 bg-card shadow-elevated-sm">
      <SidebarHeader className="px-4 pb-3 pt-4 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-2">
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:flex-col">
          <div className="min-w-0 flex-1 rounded-[1.2rem] border border-primary/10 bg-gradient-to-br from-primary/12 via-primary/5 to-card px-3 py-2.5 shadow-elevated-sm group-data-[collapsible=icon]:hidden">
            <TaskManagerBrand size="md" linkTo="/dashboard" />
          </div>
          <div className="hidden group-data-[collapsible=icon]:block">
            <TaskManagerBrand size="sm" showWordmark={false} linkTo="/dashboard" />
          </div>

          <RailTooltip label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            <button
              type="button"
              onClick={toggleSidebar}
              data-test="sidebar-collapse-button"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:inline-flex"
            >
              <ToggleIcon className="h-4 w-4" />
            </button>
          </RailTooltip>
        </div>

        <WorkspaceSwitcher
          className={collapsed ? 'mt-2' : 'mt-2 py-1.5'}
          compact
          iconOnly={collapsed}
        />
      </SidebarHeader>

      <SidebarContent className="px-3 pb-1 group-data-[collapsible=icon]:px-2 md:overflow-hidden">
        <NavGroup title="Access" items={invitationNav} collapsed={collapsed} className="mb-3" />

        {hasWorkspaceNav && (
          <NavGroup
            title="Workspace"
            items={workspaceNav}
            collapsed={collapsed}
            showSeparator={invitationNav.length > 0}
            className="mb-3"
          />
        )}

        <NavGroup
          title="Mentoring"
          items={mentorNav}
          collapsed={collapsed}
          showSeparator={hasWorkspaceNav || invitationNav.length > 0}
          className="mb-3"
        />

        <NavGroup
          title="Internship"
          items={internNav}
          collapsed={collapsed}
          showSeparator={hasWorkspaceNav || invitationNav.length > 0}
          className="mb-3"
        />

        <NavGroup
          title="Admin"
          items={adminNav}
          collapsed={collapsed}
          showSeparator={hasWorkspaceNav || mentorNav.length > 0 || invitationNav.length > 0}
        />
      </SidebarContent>

      <SidebarFooter className="p-3 pt-2 group-data-[collapsible=icon]:p-2">
        {/* Three peer icons next to the avatar left ~70px for the name at 16rem,
            which truncated it to "Admi…". So profile, appearance and logout fold
            into one menu on the identity row, and notifications stay the single
            standalone icon — it is the only one whose state (unread) has to be
            readable without opening anything. */}
        <div className="flex items-center gap-1 rounded-[1.2rem] app-elevated-sm p-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-1 group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:shadow-none">
          {isLoginPending ? (
            <div className="flex w-full animate-pulse items-center gap-3 p-1">
              <div className="h-8 w-8 shrink-0 rounded-full bg-muted" />
              <div className="space-y-2 group-data-[collapsible=icon]:hidden">
                <div className="h-3 w-20 rounded bg-muted" />
                <div className="h-2 w-12 rounded bg-muted" />
              </div>
            </div>
          ) : (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    data-test="sidebar-user-menu-trigger"
                    className={cn(
                      `flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-1.5 text-left text-sm text-foreground transition-all duration-300 ${RAIL_EASE} hover:bg-sidebar-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`,
                      'group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:px-0'
                    )}
                    aria-label={`Account menu for ${user?.fullname || 'your account'}`}
                  >
                    <Avatar users={[user]} />
                    <span className={cn('min-w-0 flex-1', collapsibleLabel)}>
                      <span className="block truncate font-semibold">
                        {user?.fullname || 'Unknown User'}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {capitalizeFirst(user?.role) || 'User'}
                      </span>
                    </span>
                    <ChevronsUpDown
                      className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground', collapsibleLabel)}
                    />
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent side="right" align="end" className="w-56">
                  <DropdownMenuLabel className="min-w-0">
                    <span className="block truncate">{user?.fullname || 'Unknown User'}</span>
                    <span className="block truncate text-xs font-normal text-muted-foreground">
                      {user?.email}
                    </span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild data-test="sidebar-nav-profile-link">
                    <NavLink to="/profile" end className="flex items-center gap-2.5">
                      <UserRound className="size-4 shrink-0" />
                      Profile
                    </NavLink>
                  </DropdownMenuItem>
                  <ThemeAppearanceSubmenu />
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    data-test="sidebar-logout-button"
                    onSelect={() => logout()}
                    className="flex items-center gap-2.5 text-destructive focus:text-destructive"
                  >
                    <LogOut className="size-4 shrink-0" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* 32px in the rail: the default 40px trigger overflows the 3rem
                  rail, so ask NavbarNotifications for its small size directly. */}
              <div className="shrink-0">
                <NavbarNotifications size="sm" />
              </div>
            </>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
