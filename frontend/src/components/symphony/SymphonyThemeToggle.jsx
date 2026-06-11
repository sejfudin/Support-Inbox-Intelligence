import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function SymphonyThemeToggle({ className, compact = false }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={cn('h-9 rounded-xl bg-muted/40', compact ? 'w-9' : 'w-full', className)}
        aria-hidden
      />
    );
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <Button
      type="button"
      variant="outline"
      size={compact ? 'icon' : 'default'}
      className={cn(
        compact
          ? 'shrink-0 border-border/60'
          : 'w-full justify-start gap-2 border-border/60 bg-transparent text-sm font-medium',
        className
      )}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      data-test="symphony-theme-toggle-button"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      {!compact && (isDark ? 'Light mode' : 'Dark mode')}
    </Button>
  );
}
