import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Accessibility,
  Bell,
  KeyRound,
  Palette,
  SlidersHorizontal,
  UserRound,
  Zap,
} from 'lucide-react';

import PageHeading from '@/components/PageHeading';
import { PageSection, PageShell } from '@/components/PageShell';
import SettingsSection, { SettingsRow } from '@/components/settings/SettingsSection';
import DesktopNotificationsRow from '@/components/settings/DesktopNotificationsRow';
import QuickActionsRows from '@/components/settings/QuickActionsRows';
import SegmentedControl from '@/components/settings/SegmentedControl';
import PreferenceControl from '@/components/settings/PreferenceControl';
import { AccentSelect, ThemeModeControl } from '@/components/settings/AppearanceControls';
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
import {
  DEFAULT_ONBOARDING_ENABLED,
  ONBOARDING_ENABLED_STORAGE_KEY,
  isValidOnboardingEnabled,
} from '@/helpers/onboardingTour';
import { Switch } from '@/components/ui/switch';
import { useStoredPreference } from '@/hooks/useStoredPreference';

/** Label and a full-width select — the field shape the defaults grid uses. */
function SettingsField({ label, value, options, onChange, dataTest }) {
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
    </label>
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

  const { uiScale, contrast, setPreference, preferenceOptions, ready } = useThemeConfig();
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
  const [onboardingEnabled, setOnboardingEnabled] = useStoredPreference(
    ONBOARDING_ENABLED_STORAGE_KEY,
    DEFAULT_ONBOARDING_ENABLED,
    isValidOnboardingEnabled
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
          <SettingsRow label="Role">
            <span className="app-chip bg-muted text-muted-foreground">
              {capitalizeFirst(user?.role) || 'User'}
            </span>
          </SettingsRow>
          <SettingsRow label="Password">
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
          description="Theme and accent — saved to your account."
          tour="settings-appearance"
        >
          <SettingsRow label="Theme">
            <ThemeModeControl />
          </SettingsRow>
          <SettingsRow label="Accent" className="sm:items-start">
            <AccentSelect />
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
          description="Contrast follows your account; size stays on this device."
          tour="settings-accessibility"
        >
          <SettingsRow label="Text & UI size">
            <PreferenceControl
              label="Text and UI size"
              preferenceKey="uiScale"
              value={uiScale}
              options={preferenceOptions.uiScale}
              onChange={setPreference}
              ready={ready}
            />
          </SettingsRow>
          <SettingsRow label="Contrast">
            <PreferenceControl
              label="Contrast"
              preferenceKey="contrast"
              value={contrast}
              options={preferenceOptions.contrast}
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
              value={landingPage}
              options={LANDING_PAGE_OPTIONS}
              onChange={setLandingPage}
              dataTest="settings-landing-page-select"
            />
            <SettingsField
              label="Ticket view"
              value={ticketsView}
              options={TICKETS_VIEW_OPTIONS}
              onChange={setTicketsView}
              dataTest="settings-tickets-view-select"
            />
            <SettingsField
              label="Default assignee filter"
              value={assigneeDefault}
              options={ASSIGNEE_DEFAULT_OPTIONS}
              onChange={setAssigneeDefault}
              dataTest="settings-assignee-default-select"
            />
            <SettingsField
              label="Board card order"
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
              <SettingsRow key={group.key} label={group.label}>
                <Switch
                  checked={enabled}
                  onCheckedChange={() => toggleNotificationGroup(group.key)}
                  aria-label={group.label}
                  data-test={`settings-notify-${group.key}-switch`}
                />
              </SettingsRow>
            );
          })}

          <SettingsRow label="Onboarding tour">
            <Switch
              checked={onboardingEnabled === 'on'}
              onCheckedChange={(checked) => setOnboardingEnabled(checked ? 'on' : 'off')}
              aria-label="Onboarding tour"
              data-test="settings-onboarding-tour-switch"
            />
          </SettingsRow>
        </SettingsSection>
      </PageSection>
    </PageShell>
  );
}
