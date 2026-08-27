import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from 'next-themes';
import {
  Accessibility,
  Bell,
  Circle,
  Contrast,
  KeyRound,
  LayoutGrid,
  Monitor,
  Moon,
  Palette,
  Rows3,
  SlidersHorizontal,
  Sun,
  UserRound,
  Zap,
} from 'lucide-react';

import PageHeading from '@/components/PageHeading';
import { PageSection, PageShell } from '@/components/PageShell';
import SettingsSection, { SettingsRow } from '@/components/settings/SettingsSection';
import DesktopNotificationsRow from '@/components/settings/DesktopNotificationsRow';
import QuickActionsRows from '@/components/settings/QuickActionsRows';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/context/AuthContext';
import { quickActionsForRole } from '@/helpers/quickActions';
import { ROLES } from '@/helpers/roles';
import { useThemeConfig } from '@/context/ThemeConfigContext';
import { capitalizeFirst } from '@/helpers/capitalizeFirst';
import {
  BOARD_SORT_OPTIONS,
  BOARD_SORT_STORAGE_KEY,
  DEFAULT_BOARD_SORT,
  isValidBoardSort,
} from '@/helpers/boardCardSort';
import {
  ASSIGNEE_DEFAULT_OPTIONS,
  ASSIGNEE_DEFAULT_STORAGE_KEY,
  DEFAULT_ASSIGNEE_DEFAULT,
  DEFAULT_LANDING_PAGE,
  DEFAULT_NAV_STYLE,
  DEFAULT_TICKETS_VIEW,
  LANDING_PAGE_OPTIONS,
  LANDING_PAGE_STORAGE_KEY,
  NAV_STYLE_OPTIONS,
  NAV_STYLE_STORAGE_KEY,
  TICKETS_VIEW_OPTIONS,
  TICKETS_VIEW_STORAGE_KEY,
  isValidAssigneeDefault,
  isValidLandingPage,
  isValidNavStyle,
  isValidTicketsView,
} from '@/helpers/uiPreferences';
import {
  NOTIFICATION_GROUPS,
  NOTIFICATION_MUTED_STORAGE_KEY,
  isValidMutedGroups,
  parseMutedGroups,
  serializeMutedGroups,
} from '@/helpers/notificationPreferences';
import { Switch } from '@/components/ui/switch';
import { Switcher } from '@/components/ui/switcher';
import { useStoredPreference } from '@/hooks/useStoredPreference';
import { flashThemeTransition } from '@/lib/themeTransition';
import { cn } from '@/lib/utils';

const MODE_OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

const DENSITY_ICONS = { comfortable: Rows3, compact: LayoutGrid };

const CONTRAST_ICONS = { default: Circle, high: Contrast };

/**
 * Theme, Density and Default tickets view are all "pick one of two or three,
 * and the thing being picked stays the same" — the switcher's job exactly.
 *
 * This was a fourth hand-rolled segmented control (radius 9 track, radius 7
 * 30px thumbs). Density in particular being drawn by a bespoke control was the
 * joke that wrote itself: the setting that proves no component hardcodes its
 * geometry, hardcoding its own.
 */
function SegmentedControl({ label, options, value, onChange, testIdPrefix }) {
  return (
    <Switcher
      label={label}
      value={value}
      onChange={onChange}
      items={options.map((option) => ({
        ...option,
        dataTest: `${testIdPrefix}-${option.value}-button`,
      }))}
    />
  );
}

/** Label, hint and a full-width select — the field shape the defaults grid uses. */
function SettingsField({ label, hint, value, options, onChange, dataTest }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[13px] font-medium text-foreground">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          className="h-[var(--h-md)] w-full rounded-[var(--r-control)] text-[length:var(--fs-control)]"
          data-test={dataTest}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} className="text-[12.5px]">
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hint ? (
        <span className="text-pretty text-[11.5px] leading-[1.45] text-muted-foreground">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

/**
 * A `SegmentedControl` bound to one of the `<html>`-attribute preferences, with
 * the placeholder every one of them needs while storage is still being read.
 */
function PreferenceControl({ label, preferenceKey, value, options, icons, onChange, ready }) {
  if (!ready) {
    return <div className="h-[36px] w-[12rem] rounded-[var(--r-control)] bg-muted" aria-hidden />;
  }

  return (
    <SegmentedControl
      label={label}
      options={icons ? options.map((o) => ({ ...o, icon: icons[o.value] })) : options}
      value={value}
      onChange={(next) => onChange(preferenceKey, next)}
      testIdPrefix={`settings-${preferenceKey}`}
    />
  );
}

/** Light / Dark / System. */
function ThemeModeControl() {
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
 * The accent picker. Each tile is the palette's own gradient plus its name;
 * picking one swaps `data-theme` on <html>, which is what actually rewrites the
 * primary custom properties — the same mechanism the sidebar's Appearance menu
 * uses, so the two can never disagree.
 *
 * Named tiles rather than bare swatches: eight unlabelled squares are a memory
 * test, and the names are how the team refers to them out loud.
 */
function AccentSwatches({ disabled = false }) {
  const { colorTheme, setColorTheme, themes, ready } = useThemeConfig();

  if (!ready) {
    return <div className="h-[34px] w-[13rem] rounded-[var(--r-control)] bg-muted" aria-hidden />;
  }

  const current = themes.find((theme) => theme.id === colorTheme) ?? themes[0];

  // A dropdown rather than a grid of tiles: eleven palettes is a list, not a
  // canvas, and the row it used to occupy was three deep. The swatch travels with
  // the name into the trigger, so the current accent is still visible closed.
  return (
    <Select value={colorTheme} onValueChange={setColorTheme} disabled={disabled}>
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

export default function SettingsPage() {
  const { user } = useAuth();
  const { hash } = useLocation();

  // A route change doesn't scroll to its own `#hash` on its own — the dashboard
  // card's "Customize" link relies on this to land on the actual section instead
  // of just opening the page at the top.
  useEffect(() => {
    if (!hash) return;
    document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash]);

  const {
    density,
    uiScale,
    contrast,
    motion,
    colorblind,
    setPreference,
    preferenceOptions,
    ready,
  } = useThemeConfig();
  const [boardSort, setBoardSort] = useStoredPreference(
    BOARD_SORT_STORAGE_KEY,
    DEFAULT_BOARD_SORT,
    isValidBoardSort
  );
  const [ticketsView, setTicketsView] = useStoredPreference(
    TICKETS_VIEW_STORAGE_KEY,
    DEFAULT_TICKETS_VIEW,
    isValidTicketsView
  );
  const [landingPage, setLandingPage] = useStoredPreference(
    LANDING_PAGE_STORAGE_KEY,
    DEFAULT_LANDING_PAGE,
    isValidLandingPage
  );
  const [navStyle, setNavStyle] = useStoredPreference(
    NAV_STYLE_STORAGE_KEY,
    DEFAULT_NAV_STYLE,
    isValidNavStyle
  );
  const [assigneeDefault, setAssigneeDefault] = useStoredPreference(
    ASSIGNEE_DEFAULT_STORAGE_KEY,
    DEFAULT_ASSIGNEE_DEFAULT,
    isValidAssigneeDefault
  );
  const [mutedRaw, setMutedRaw] = useStoredPreference(
    NOTIFICATION_MUTED_STORAGE_KEY,
    '',
    isValidMutedGroups
  );

  const mutedGroups = parseMutedGroups(mutedRaw);

  // Admin today; the catalog is what decides, so this needs no edit when the
  // mentor dashboard grows a card.
  const hasQuickActions = user?.role === ROLES.ADMIN && quickActionsForRole(user?.role).length > 0;

  const toggleNotificationGroup = (key) =>
    setMutedRaw(
      serializeMutedGroups(
        mutedGroups.includes(key)
          ? mutedGroups.filter((muted) => muted !== key)
          : [...mutedGroups, key]
      )
    );

  return (
    <PageShell>
      <PageSection className="space-y-3.5">
        <PageHeading
          crumb="Account"
          title="Settings"
          subtitle="Preferences for your account, appearance and this workspace."
        />

        <SettingsSection
          icon={UserRound}
          title="Account"
          description="Who you are signed in as, and how to change it."
        >
          <SettingsRow label="Name" hint={user?.email}>
            <span className="text-[12.5px] text-muted-foreground">
              {user?.fullname || 'Unknown user'}
            </span>
          </SettingsRow>
          <SettingsRow label="Role" hint="Set by an admin — it decides what you can see and do.">
            <span className="app-chip bg-muted text-muted-foreground">
              {capitalizeFirst(user?.role) || 'User'}
            </span>
          </SettingsRow>
          <SettingsRow
            label="Password"
            hint="Changing it needs your current password and signs out your other devices."
          >
            <Button
              asChild
              variant="outline"
              size="sm"
              className="rounded-[var(--r-control)] text-[12.5px]"
            >
              <Link to="/profile" data-test="settings-change-password-link">
                <KeyRound className="mr-1.5 h-3.5 w-3.5" />
                Change
              </Link>
            </Button>
          </SettingsRow>
        </SettingsSection>

        <SettingsSection
          icon={Palette}
          title="Appearance"
          description="Theme, accent and row density — saved to your account."
          tour="settings-appearance"
        >
          <SettingsRow label="Theme" hint="Light, dark, or follow your system.">
            <ThemeModeControl />
          </SettingsRow>
          <SettingsRow
            label="Accent"
            // Saying so beats a control that silently does nothing: a colour
            // vision mode replaces the palette outright, so the picker still
            // remembers your choice but nothing on screen moves until it is off.
            hint={
              colorblind === 'off'
                ? 'Colours buttons, links, active nav and charts across the app.'
                : 'Paused — the colour vision setting below is using its own palette. Your choice is kept for when you turn it off.'
            }
            className="sm:items-start"
          >
            <AccentSwatches disabled={colorblind !== 'off'} />
          </SettingsRow>
          <SettingsRow
            label="Density"
            hint="Compact takes table rows from 46px to 38px — roughly four more rows a screen."
          >
            <PreferenceControl
              label="Density"
              preferenceKey="density"
              value={density}
              options={preferenceOptions.density}
              icons={DENSITY_ICONS}
              onChange={setPreference}
              ready={ready}
            />
          </SettingsRow>
          <SettingsRow
            label="Sidebar sections"
            // Says what each choice costs rather than naming them again: the two
            // segments are already labelled, and the only thing worth knowing is
            // that Collapsible remembers per device while Labelled cannot hide
            // anything.
            hint="Collapsible gives each group a header you can open and close, remembered on this device. Labelled is the plain captioned list, always open."
          >
            <SegmentedControl
              label="Sidebar sections"
              options={NAV_STYLE_OPTIONS}
              value={navStyle}
              onChange={setNavStyle}
              testIdPrefix="settings-nav-style"
            />
          </SettingsRow>
        </SettingsSection>

        <SettingsSection
          icon={Accessibility}
          title="Accessibility"
          description="Contrast, colour and motion follow your account; size stays on this device."
          tour="settings-accessibility"
        >
          <SettingsRow
            label="Text & UI size"
            hint="Scales the whole interface, not just type. Kept per device, since a laptop and a large monitor want different answers. Full-height views may gain a little scroll at 125%."
          >
            <PreferenceControl
              label="Text and UI size"
              preferenceKey="uiScale"
              value={uiScale}
              options={preferenceOptions.uiScale}
              onChange={setPreference}
              ready={ready}
            />
          </SettingsRow>
          <SettingsRow
            label="Contrast"
            hint="Darkens borders and secondary text, and puts a visible focus ring on everything you can tab to."
          >
            <PreferenceControl
              label="Contrast"
              preferenceKey="contrast"
              value={contrast}
              options={preferenceOptions.contrast}
              icons={CONTRAST_ICONS}
              onChange={setPreference}
              ready={ready}
            />
          </SettingsRow>
          <SettingsRow
            label="Colour vision"
            hint="Repaints every status chip, dot and pill. Red–green covers deuteranomaly and protanomaly; Blue–yellow covers tritanopia; Complete separates the tones by lightness alone."
          >
            <PreferenceControl
              label="Colour vision"
              preferenceKey="colorblind"
              value={colorblind}
              options={preferenceOptions.colorblind}
              onChange={setPreference}
              ready={ready}
            />
          </SettingsRow>
          <SettingsRow
            label="Motion"
            hint="Reduced turns off the theme cross-fade, panel slides and card transitions."
          >
            <PreferenceControl
              label="Motion"
              preferenceKey="motion"
              value={motion}
              options={preferenceOptions.motion}
              onChange={setPreference}
              ready={ready}
            />
          </SettingsRow>
        </SettingsSection>

        {/* Four field-shaped answers rather than four rows: these are all "pick a
            value", they are read together when you set the app up, and stacked
            label/hint/control rows spent a whole screen saying it. */}
        <SettingsSection
          icon={SlidersHorizontal}
          title="Workspace defaults"
          description="How the app opens for you."
          tour="settings-defaults"
        >
          <div className="grid gap-x-5 gap-y-3.5 py-[15px] sm:grid-cols-2">
            <SettingsField
              label="Landing page"
              hint="Where the logo and a bare / take you."
              value={landingPage}
              options={LANDING_PAGE_OPTIONS}
              onChange={setLandingPage}
              dataTest="settings-landing-page-select"
            />
            <SettingsField
              label="Ticket view"
              hint="Used when the link carries no view. The Tickets toggle updates this."
              value={ticketsView}
              options={TICKETS_VIEW_OPTIONS}
              onChange={setTicketsView}
              dataTest="settings-tickets-view-select"
            />
            <SettingsField
              label="Default assignee filter"
              hint="Seeds the Tickets filter when you arrive without one."
              value={assigneeDefault}
              options={ASSIGNEE_DEFAULT_OPTIONS}
              onChange={setAssigneeDefault}
              dataTest="settings-assignee-default-select"
            />
            <SettingsField
              label="Board card order"
              hint="The order cards take inside every board column."
              value={boardSort}
              options={BOARD_SORT_OPTIONS}
              onChange={setBoardSort}
              dataTest="settings-board-sort-select"
            />
          </div>
        </SettingsSection>

        {/* Only for a role that actually has the card. The mentor catalog exists
            (`helpers/quickActions.js`) but nothing renders it yet — their
            `/dashboard` is still the assigned-tickets table — and offering to
            configure a card they cannot see would be a settings page lying to
            them. Widen this when the mentor dashboard lands. */}
        {hasQuickActions && (
          <SettingsSection
            id="quick-actions"
            icon={Zap}
            title="Quick actions"
            description="The shortcut list on your dashboard — which ones, and in what order."
          >
            <QuickActionsRows role={user?.role} />
          </SettingsSection>
        )}

        <SettingsSection
          icon={Bell}
          title="Notifications"
          description="What reaches you, and where."
          tour="settings-notifications"
        >
          <DesktopNotificationsRow />

          {NOTIFICATION_GROUPS.map((group) => {
            const enabled = !mutedGroups.includes(group.key);
            return (
              <SettingsRow key={group.key} label={group.label} hint={group.hint}>
                <Switch
                  checked={enabled}
                  onCheckedChange={() => toggleNotificationGroup(group.key)}
                  aria-label={group.label}
                  data-test={`settings-notify-${group.key}-switch`}
                />
              </SettingsRow>
            );
          })}
        </SettingsSection>
      </PageSection>
    </PageShell>
  );
}
