import { NavLink } from 'react-router-dom';
import { ChevronDown, LogOut, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SymphonyWordmark } from './SymphonyWordmark';
import NavbarNotifications from '@/components/NavbarNotifications';
import { useAuth } from '@/context/AuthContext';
import { useLogoutUser } from '@/queries/auth';
import { useStaffingRequestNews } from '@/queries/staffingRequests';
import { getInitials } from '@/helpers/initials';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  {
    to: '/programme',
    label: 'Dashboard',
    testId: 'symphony-nav-dashboard-link',
  },
  {
    to: '/interns',
    label: 'Candidates',
    testId: 'symphony-nav-interns-link',
  },
  {
    to: '/projects',
    label: 'Projects',
    testId: 'symphony-nav-projects-link',
  },
  {
    to: '/requests',
    label: 'Requests',
    testId: 'symphony-nav-requests-link',
  },
];

export function SymphonyNav() {
  const { user } = useAuth();
  const { mutate: logout } = useLogoutUser();
  const { resolvedTheme, setTheme } = useTheme();
  const initials = getInitials(user?.fullname, 'L');
  const { data: news } = useStaffingRequestNews();
  const requestsBadge = news?.count > 0 ? news.count : null;
  const isDark = resolvedTheme === 'dark';

  return (
    <header className="symphony-navbar sticky top-0 z-40">
      <div className="symphony-page symphony-navbar-inner">
        <SymphonyWordmark />

        <nav className="symphony-navbar-nav" aria-label="Leadership navigation">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/programme'}
              data-test={item.testId}
              className={({ isActive }) =>
                cn('symphony-nav-item', isActive && 'symphony-nav-item-active')
              }
            >
              <span>{item.label}</span>
              {item.to === '/requests' && requestsBadge && (
                <span className="symphony-nav-badge" data-test="symphony-nav-requests-badge">
                  {requestsBadge > 99 ? '99+' : requestsBadge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="symphony-navbar-end">
          <NavbarNotifications />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="symphony-navbar-account"
                aria-label="Account menu"
                data-test="symphony-nav-account-button"
              >
                <span className="symphony-navbar-avatar" aria-hidden>
                  {initials}
                </span>
                <ChevronDown className="symphony-navbar-account-chevron" aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="flex flex-col gap-0.5">
                <span className="truncate text-sm font-semibold text-foreground">
                  {user?.fullname || 'Leadership'}
                </span>
                <span className="truncate text-xs font-normal text-muted-foreground">
                  {user?.email}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  setTheme(isDark ? 'light' : 'dark');
                }}
                data-test="symphony-nav-theme-item"
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                {isDark ? 'Light mode' : 'Dark mode'}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => logout()} data-test="symphony-nav-logout-item">
                <LogOut className="h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
