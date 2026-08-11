import { NavLink } from 'react-router-dom';
import { Briefcase, GraduationCap, LayoutDashboard, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SymphonyWordmark } from './SymphonyWordmark';
import { SymphonyThemeToggle } from './SymphonyThemeToggle';
import NavbarNotifications from '@/components/NavbarNotifications';
import { useAuth } from '@/context/AuthContext';
import { useLogoutUser } from '@/queries/auth';
import { getInitials } from '@/helpers/initials';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  {
    to: '/programme',
    label: 'Dashboard',
    icon: LayoutDashboard,
    testId: 'symphony-nav-dashboard-link',
  },
  {
    to: '/interns',
    label: 'Candidates',
    icon: GraduationCap,
    testId: 'symphony-nav-interns-link',
  },
  {
    to: '/projects',
    label: 'Projects',
    icon: Briefcase,
    testId: 'symphony-nav-projects-link',
  },
];

export function SymphonyNav() {
  const { user } = useAuth();
  const { mutate: logout } = useLogoutUser();
  const initials = getInitials(user?.fullname, 'L');

  return (
    <header className="symphony-navbar sticky top-0 z-40">
      <div className="symphony-page symphony-navbar-inner">
        <div className="symphony-navbar-start">
          <SymphonyWordmark />
          <div className="min-w-0 sm:hidden">
            <p className="symphony-navbar-kicker truncate">Future Experts Programme</p>
          </div>
          <div className="symphony-navbar-divider hidden sm:block" aria-hidden />
          <div className="symphony-navbar-programme hidden min-w-0 sm:block">
            <p className="symphony-navbar-kicker">Future Experts Programme</p>
            <p className="symphony-navbar-programme-title">Leadership portal</p>
          </div>
        </div>

        <nav className="symphony-navbar-nav" aria-label="Leadership navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/programme'}
                data-test={item.testId}
                className={({ isActive }) =>
                  cn('symphony-nav-item', isActive && 'symphony-nav-item-active')
                }
              >
                <Icon className="h-[1.125rem] w-[1.125rem] shrink-0" aria-hidden />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="symphony-navbar-end">
          <div className="symphony-navbar-user hidden xl:flex">
            <span className="symphony-navbar-avatar" aria-hidden>
              {initials}
            </span>
            <div className="min-w-0 text-left">
              <p className="max-w-[12rem] truncate text-sm font-semibold text-foreground">
                {user?.fullname || 'Leadership'}
              </p>
              <p className="max-w-[12rem] truncate text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          <div className="symphony-navbar-controls">
            <NavbarNotifications />
            <SymphonyThemeToggle compact className="symphony-navbar-icon-button" />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="symphony-navbar-logout hidden h-10 gap-2 px-3 md:inline-flex"
              onClick={() => logout()}
              data-test="symphony-nav-logout-button"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden lg:inline">Logout</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="symphony-navbar-icon-button md:hidden"
              onClick={() => logout()}
              aria-label="Logout"
              data-test="symphony-nav-logout-mobile-button"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
