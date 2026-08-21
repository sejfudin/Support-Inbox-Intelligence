import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Check, Monitor, Moon, Palette, Sun } from 'lucide-react';

import { useThemeConfig } from '@/context/ThemeConfigContext';
import { flashThemeTransition } from '@/lib/themeTransition';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

const MODE_OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

function ModeToggle({ className, size = 'sm' }) {
  const { theme, setTheme } = useTheme();
  const { ready } = useThemeConfig();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !ready) {
    return (
      <div
        className={cn(
          'h-9 rounded-[var(--r-control)] border border-border/70 bg-muted/50',
          className
        )}
        aria-hidden
      />
    );
  }

  const currentMode = theme || 'system';

  return (
    <ToggleGroup
      type="single"
      value={currentMode}
      onValueChange={(value) => {
        if (!value) return;
        flashThemeTransition();
        setTheme(value);
      }}
      className={cn(
        'grid w-full grid-cols-3 gap-1 rounded-[var(--r-control)] border border-border/70 p-1',
        className
      )}
      size={size}
    >
      {MODE_OPTIONS.map(({ value, label, icon: Icon }) => (
        <ToggleGroupItem
          key={value}
          value={value}
          data-test={`theme-mode-${value}-button`}
          aria-label={label}
          className="flex flex-1 items-center justify-center gap-2.5 rounded-[var(--r-control)] px-2 py-1.5 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          <Icon className="size-3.5 shrink-0" />
          <span className="hidden sm:inline">{label}</span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

function PaletteGrid({ className }) {
  const { colorTheme, setColorTheme, themes, ready } = useThemeConfig();

  if (!ready) {
    return (
      <div className={cn('h-24 rounded-[var(--r-control)] bg-muted/50', className)} aria-hidden />
    );
  }

  return (
    <div className={cn('grid grid-cols-3 gap-2', className)}>
      {themes.map((theme) => {
        const isActive = colorTheme === theme.id;
        return (
          <button
            key={theme.id}
            type="button"
            data-test={`theme-palette-${theme.id}-button`}
            onClick={() => setColorTheme(theme.id)}
            className={cn(
              'relative flex flex-col items-start gap-1 rounded-[var(--r-card)] border p-2 text-left transition-colors',
              isActive
                ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                : 'border-border/70 bg-card hover:border-primary/30 hover:bg-muted/50'
            )}
            aria-pressed={isActive}
            aria-label={`${theme.label} theme`}
          >
            <span className="flex w-full items-center gap-1.5">
              <span
                className="size-4 shrink-0 rounded-full border border-border/60"
                style={{ background: theme.preview.primary }}
              />
              <span
                className="h-2 flex-1 rounded-full border border-border/40"
                style={{ background: theme.preview.background }}
              />
            </span>
            <span className="text-[11px] font-semibold text-foreground">{theme.label}</span>
            {isActive ? (
              <Check className="absolute top-1.5 right-1.5 size-3 text-primary" aria-hidden />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The mode + palette radio groups on their own, so they can be dropped either
 * into a top-level DropdownMenuContent or into a submenu without duplicating the
 * option lists. `showHeading` is off in a submenu, where the trigger already
 * names the section.
 */
function ThemeAppearanceItems({ showHeading = true }) {
  const { colorTheme, setColorTheme, themes } = useThemeConfig();
  const { theme, setTheme } = useTheme();

  return (
    <>
      {showHeading && (
        <>
          <DropdownMenuLabel>Appearance</DropdownMenuLabel>
          <DropdownMenuSeparator />
        </>
      )}
      <DropdownMenuRadioGroup
        value={theme || 'system'}
        onValueChange={(value) => {
          flashThemeTransition();
          setTheme(value);
        }}
      >
        {MODE_OPTIONS.map(({ value, label, icon: Icon }) => (
          <DropdownMenuRadioItem
            key={value}
            value={value}
            data-test={`theme-appearance-mode-${value}-radio`}
          >
            <span className="flex items-center gap-2.5">
              <Icon className="size-4 shrink-0" />
              {label}
            </span>
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
      <DropdownMenuSeparator />
      <DropdownMenuLabel className="text-xs text-muted-foreground">Color palette</DropdownMenuLabel>
      <DropdownMenuRadioGroup value={colorTheme} onValueChange={setColorTheme}>
        {themes.map((t) => (
          <DropdownMenuRadioItem
            key={t.id}
            value={t.id}
            data-test={`theme-appearance-palette-${t.id}-radio`}
          >
            {/* The palette's own gradient beside its name — eleven names in a
                list is a vocabulary test otherwise, and the swatch is what the
                reader is actually choosing between. */}
            <span className="flex items-center gap-2.5">
              <span
                className="size-3.5 shrink-0 rounded-full border border-border/50"
                style={{ backgroundImage: t.preview.gradient }}
                aria-hidden="true"
              />
              {t.label}
            </span>
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </>
  );
}

function ThemeAppearanceMenu({ align = 'end' }) {
  return (
    <DropdownMenuContent align={align} className="w-56">
      <ThemeAppearanceItems />
    </DropdownMenuContent>
  );
}

/**
 * Appearance as a nested submenu — used by the sidebar's user menu, which folds
 * theme, profile and logout into one control so the footer isn't a row of
 * competing icons.
 */
export function ThemeAppearanceSubmenu() {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger data-test="theme-appearance-submenu-trigger">
        <span className="flex items-center gap-2.5">
          <Palette className="size-4 shrink-0" />
          Appearance
        </span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-52">
        <ThemeAppearanceItems showHeading={false} />
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

const topBarIconButtonClass =
  'h-10 w-10 shrink-0 rounded-full text-foreground hover:bg-muted/60 hover:text-foreground';

export function ThemeSwitcherIcon() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        data-test="theme-switcher-trigger"
        className={topBarIconButtonClass}
        disabled
        aria-label="Theme"
      >
        <Palette className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          data-test="theme-switcher-trigger"
          className={topBarIconButtonClass}
          aria-label="Change theme"
        >
          <Palette className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <ThemeAppearanceMenu align="end" />
    </DropdownMenu>
  );
}

export function ThemeSwitcherCompact() {
  const [mounted, setMounted] = useState(false);
  const { colorTheme, themes } = useThemeConfig();

  useEffect(() => {
    setMounted(true);
  }, []);

  const activePalette = themes.find((t) => t.id === colorTheme);

  if (!mounted) {
    return (
      <Button
        variant="outline"
        size="sm"
        data-test="theme-switcher-compact-trigger"
        className="w-full justify-start"
        disabled
      >
        <Palette className="size-4" />
        Theme
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          data-test="theme-switcher-compact-trigger"
          className="w-full justify-start gap-2"
        >
          <Palette className="size-4 shrink-0" />
          <span className="truncate">{activePalette?.label ?? 'Theme'}</span>
        </Button>
      </DropdownMenuTrigger>
      <ThemeAppearanceMenu align="start" />
    </DropdownMenu>
  );
}

export function ThemeSwitcherPanel({ className }) {
  const { ready } = useThemeConfig();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !ready) {
    return (
      <div className={cn('app-elevated space-y-4 rounded-[1.25rem] p-4', className)}>
        <div className="h-5 w-32 rounded bg-muted" />
        <div className="h-9 rounded-[var(--r-control)] bg-muted/50" />
        <div className="h-24 rounded-[var(--r-control)] bg-muted/50" />
      </div>
    );
  }

  return (
    <div className={cn('app-elevated space-y-4 rounded-[1.25rem] p-4 sm:p-5', className)}>
      <div>
        <h3 className="text-sm font-semibold text-foreground">Appearance</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Choose a color palette and light or dark mode. Saved on this device.
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Mode</Label>
        <ModeToggle />
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Color palette</Label>
        <PaletteGrid />
      </div>
    </div>
  );
}

export default function ThemeSwitcher({ variant = 'compact' }) {
  if (variant === 'panel') {
    return <ThemeSwitcherPanel />;
  }
  return <ThemeSwitcherCompact />;
}
