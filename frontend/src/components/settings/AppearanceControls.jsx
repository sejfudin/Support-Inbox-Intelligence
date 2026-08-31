import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Monitor, Moon, Sun } from 'lucide-react';

import SegmentedControl from '@/components/settings/SegmentedControl';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useThemeConfig } from '@/context/ThemeConfigContext';
import { flashThemeTransition } from '@/lib/themeTransition';

/**
 * The two appearance controls, shared by both settings pages (`SettingsPage`,
 * `LeadershipSettingsPage`). Neither reads a workspace, which is why they are
 * the part of Appearance that both surfaces can show.
 */

const MODE_OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

/** Light / Dark / System. */
export function ThemeModeControl() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // `theme` is unknowable until after hydration — rendering a guess would flash
  // the wrong segment as active.
  if (!mounted) {
    return <div className="h-[36px] w-[13.5rem] rounded-[var(--r-control)] bg-muted" aria-hidden />;
  }

  return (
    <SegmentedControl
      label="Theme"
      options={MODE_OPTIONS}
      value={theme || 'system'}
      onChange={(value) => {
        flashThemeTransition();
        setTheme(value);
      }}
      testIdPrefix="settings-theme"
    />
  );
}

/**
 * The accent picker. Picking one swaps `data-theme` on <html>, which is what
 * actually rewrites the primary custom properties — the same mechanism the
 * sidebar's Appearance menu and the leadership navbar's theme item use, so the
 * three can never disagree.
 *
 * A dropdown rather than a grid of tiles: eleven palettes is a list, not a
 * canvas, and the row it used to occupy was three deep. The swatch travels with
 * the name into the trigger, so the current accent is still visible closed.
 * Named rather than bare swatches, too — unlabelled squares are a memory test,
 * and the names are how the team refers to them out loud.
 */
export function AccentSelect() {
  const { colorTheme, setColorTheme, themes, ready } = useThemeConfig();

  if (!ready) {
    return <div className="h-[34px] w-[13rem] rounded-[var(--r-control)] bg-muted" aria-hidden />;
  }

  const current = themes.find((theme) => theme.id === colorTheme) ?? themes[0];

  return (
    <Select value={colorTheme} onValueChange={setColorTheme}>
      <SelectTrigger
        className="h-[34px] w-[13rem] rounded-[var(--r-control)] text-[12.5px]"
        aria-label="Accent"
        data-test="settings-accent-select"
      >
        <span className="flex min-w-0 items-center gap-2">
          <PaletteSwatch theme={current} />
          <span className="truncate">{current.label}</span>
        </span>
      </SelectTrigger>
      <SelectContent>
        {themes.map((theme) => (
          <SelectItem
            key={theme.id}
            value={theme.id}
            className="text-[12.5px]"
            data-test={`settings-accent-${theme.id}-option`}
          >
            <span className="flex items-center gap-2">
              <PaletteSwatch theme={theme} />
              {theme.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function PaletteSwatch({ theme }) {
  return (
    <span
      className="size-3.5 shrink-0 rounded-full border border-border/50"
      style={{ backgroundImage: theme.preview.gradient }}
      aria-hidden="true"
    />
  );
}
