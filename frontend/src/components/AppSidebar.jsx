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
  Target,
  TrendingUp,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronsUpDown,
  UserRound,
} from 'lucide-react';
import WorkspaceSwitcher from '@/components/WorkspaceSwitcher';
import { ThemeAppearanceSubmenu } from '@/components/ThemeSwitcher';
import { WhatsNewButton } from '@/components/onboarding/WhatsNewButton';
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
import { useAttendanceRequests } from '@/queries/attendanceRequests';
import { useStaffingRequestNews } from '@/queries/staffingRequests';
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
      // Every nav row is tour-targetable by route, so announcing a feature in
      // `whatsNewSteps.js` needs no change here — point a step at
      // `[data-tour="nav-<slug>"]`. Derived from `to` rather than configured per
      // item so the two can never drift apart.
      data-tour={`nav-${navTestSlug(item.to)}`}
      className={cn(
        `relative flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all duration-300 ${RAIL_EASE}`,
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
      {/* "Something here needs you", with no number attached — used where a count
          would be noise (one pending remote-work request is as actionable as four).
          Positioned absolutely rather than in the flow so it survives the rail:
          `collapsibleLabel` crossfades the label to zero width when collapsed, and
          an inline dot would go with it, which is exactly when the dot matters
          most. Amber matches the `warning` badge the same pending state uses on
          the Attendance page, so one signal reads as one thing. */}
      {item.dot ? (
        <span
          // Vertically centred on the row, not pinned to its top edge — the row is
          // a single line of text, so a top-aligned dot reads as misaligned rather
          // than as a badge. In the collapsed rail it moves to the icon's top
          // corner instead, where centring would sit it on top of the glyph.
          className="pointer-events-none absolute right-2 top-1/2 flex h-2 w-2 -translate-y-1/2 group-data-[collapsible=icon]:right-0.5 group-data-[collapsible=icon]:top-0.5 group-data-[collapsible=icon]:translate-y-0"
          aria-hidden="true"
        >
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-75 motion-reduce:animate-none" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
        </span>
      ) : null}
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

  // The dot is the only cue in the rail, and a dot alone says nothing about what
  // is waiting — so the tooltip is where it gets named.
  const suffix = item.badge
    ? ` (${item.badge})`
    : item.dotLabel && item.dot
      ? ` — ${item.dotLabel}`
      : '';

  return <RailTooltip label={`${item.label}${suffix}`}>{link}</RailTooltip>;
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
  // Admin-only route (`requireRole(ADMIN, LEADERSHIP)`); gate the query so a
  // mentor/intern sidebar never fires a request that would 403.
  const { data: staffingNews } = useStaffingRequestNews({ enabled: isAdmin(user?.role) });
  const staffingRequestsBadge = staffingNews?.count > 0 ? staffingNews.count : undefined;

  // Admin-only: the endpoint is admin-guarded, so asking as anyone else is a
  // guaranteed 403. Shares its query key with the Attendance page's own fetch, so
  // opening that page costs no extra request.
  const { data: attendanceRequests } = useAttendanceRequests(
    { status: 'pending' },
    { enabled: isAdmin(user?.role) }
  );
  const pendingRequests = attendanceRequests?.pendingCount ?? 0;

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
        // First in the group: it is the read-only overview of everything the
        // programme records about them, and the two rows below it are the parts they
        // can act on (declare a technology, check in).
        { label: 'My Progress', to: '/my-progress', icon: TrendingUp },
        { label: 'Position & Technologies', to: '/my-technologies', icon: Code2 },
        { label: 'Attendance', to: '/my-attendance', icon: CalendarCheck },
      ]
    : [];

  const adminNav = isAdmin(user?.role)
    ? [
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
          label: 'Attendance',
          to: '/attendance',
          icon: CalendarCheck,
          // Time-away requests are decided by admins (mentors have no attendance
          // view at all), and a request nobody notices goes stale on the very day
          // it was asked for — so the pending state has to be visible from
          // anywhere in the app, not only once you are already on the page. A sick
          // day makes that sharper still: it is always for today or the last couple
          // of days, so an unanswered one is stale almost immediately.
          dot: pendingRequests > 0,
          dotLabel:
            pendingRequests === 1 ? '1 time-away request' : `${pendingRequests} time-away requests`,
        },
        {
          label: 'Daily Insights',
          to: '/admin/daily-insights',
          icon: CalendarClock,
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
        {
          label: 'Specialization',
          to: '/specialization',
          icon: Target,
        },
        {
          label: 'Requests',
          to: '/admin/staffing-requests',
          icon: ClipboardList,
          badge: staffingRequestsBadge,
        },
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
              data-tour="sidebar-collapse"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:inline-flex"
            >
              <ToggleIcon className="h-4 w-4" />
            </button>
          </RailTooltip>
        </div>

        <div data-tour="workspace-switcher">
          <WorkspaceSwitcher
            className={collapsed ? 'mt-2' : 'mt-2 py-1.5'}
            compact
            iconOnly={collapsed}
          />
        </div>
      </SidebarHeader>

      {/* Scrolls on desktop rather than clipping. This used to be `md:overflow-hidden`
          on the assumption that the nav always fits — it does for most roles, but an
          admin has the longest list, and anything that eats vertical slack (a shorter
          viewport, the what's-new button in the footer, one more admin link) pushed the
          last item out of view with no way to reach it. `overflow-y-auto` keeps the
          scrollbar invisible until it is actually needed. */}
      <SidebarContent className="px-3 pb-1 group-data-[collapsible=icon]:px-2 md:overflow-y-auto">
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

      <SidebarFooter className="p-2 pt-1.5 group-data-[collapsible=icon]:p-2">
        {/* Peer icons next to the avatar left ~70px for the name at 16rem, which
            truncated it to "Admi…". So profile, appearance and logout fold into
            one menu on the identity row — notifications live in the top bar now
            (see SidebarLayout/PageHeader), not here.

            Padding here is deliberately tight (footer p-2, row p-1.5, trigger
            px-1.5) and the avatar is `sm`: every pixel spent on chrome comes
            straight out of the name, and a real full name like
            "Sejfudin Duranović" needs all of it to survive at 16rem. */}

        {/* Directly above the account row: the tour explains the shell, so it has
            to be reachable from every page, not just a dashboard. Wrapped with a
            hairline gap rather than a margin on the button itself, so the collapsed
            icon rail does not inherit it. */}
        <div className="mb-1.5 group-data-[collapsible=icon]:mb-1">
          <WhatsNewButton collapsed={collapsed} />
        </div>

        <div className="flex items-center gap-1 rounded-[1.2rem] app-elevated-sm p-1.5 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-1 group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:shadow-none">
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
                    data-tour="user-menu"
                    className={cn(
                      `flex min-w-0 flex-1 items-center gap-2 rounded-xl px-1.5 py-1.5 text-left text-sm text-foreground transition-all duration-300 ${RAIL_EASE} hover:bg-sidebar-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`,
                      'group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:px-0'
                    )}
                    aria-label={`Account menu for ${user?.fullname || 'your account'}`}
                  >
                    <Avatar users={[user]} size="sm" />
                    <span className={cn('min-w-0 flex-1', collapsibleLabel)}>
                      <span className="block truncate font-semibold leading-5">
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
            </>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
