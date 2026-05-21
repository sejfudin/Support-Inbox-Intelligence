import NavbarNotifications from '@/components/NavbarNotifications';
import { ThemeSwitcherIcon } from '@/components/ThemeSwitcher';
import { cn } from '@/lib/utils';

export default function AppTopActions({ className }) {
  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-full border border-border/50 bg-card p-1 shadow-elevated-sm',
        className
      )}
      role="toolbar"
      aria-label="App actions"
    >
      <ThemeSwitcherIcon />
      <NavbarNotifications />
    </div>
  );
}
