import { Accessibility, Bell, Palette, UserRound } from 'lucide-react';

import SettingsSection, { SettingsRow } from '@/components/settings/SettingsSection';
import DesktopNotificationsRow from '@/components/settings/DesktopNotificationsRow';
import { ThemeModeControl } from '@/components/settings/AppearanceControls';
import PreferenceControl from '@/components/settings/PreferenceControl';
import { ChangePasswordPanel } from '@/components/profile/ChangePasswordPanel';
import { SymphonyPageHeader } from '@/components/symphony/SymphonyPageHeader';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/context/AuthContext';
import { useThemeConfig } from '@/context/ThemeConfigContext';
import { capitalizeFirst } from '@/helpers/capitalizeFirst';
import {
  NOTIFICATION_GROUPS,
  NOTIFICATION_MUTED_STORAGE_KEY,
  isValidMutedGroups,
  parseMutedGroups,
  serializeMutedGroups,
} from '@/helpers/notificationPreferences';
import { useStoredPreference } from '@/hooks/useStoredPreference';

/**
 * Settings for the leadership surface.
 *
 * Leadership has no workspace and no sidebar, so this is not `SettingsPage` on a
 * different layout — it is the subset of it that a leadership account can act
 * on. Left out on purpose, each because the thing it configures does not exist
 * here: "Workspace defaults" (landing page, ticket view, assignee filter, board
 * order), "Sidebar sections", "Quick actions", and the onboarding-tour switch
 * (the tour mounts in `SidebarLayout` only).
 *
 * Accent is left out too: the leadership surface is brand-locked in
 * `styles/symphony.css` (`[data-surface='symphony']` pins `--primary` / `--ring`
 * to the Symphony brand), so an accent picker here would set a value nothing on
 * this surface reads. Light/dark still applies and stays.
 *
 * The two pages share their controls rather than their layout — see
 * `components/settings/`. A new *account-level* setting belongs in both; a
 * workspace one belongs in `SettingsPage` alone.
 */

/**
 * Notification groups a leadership account can actually receive. The other
 * groups are ticket and attendance work — `ticket_assigned`, the review pair,
 * `daily_attendance_reminder` — which need a workspace, so a switch for them
 * would be this page offering to mute something that never arrives. Same
 * reasoning as the quick-actions gate on `SettingsPage`. Widen this if
 * leadership starts receiving one of them.
 */
const LEADERSHIP_NOTIFICATION_KEYS = ['mentions', 'programme'];

export default function LeadershipSettingsPage() {
  const { user } = useAuth();
  const { contrast, setPreference, preferenceOptions, ready } = useThemeConfig();

  const [mutedRaw, setMutedRaw] = useStoredPreference(
    NOTIFICATION_MUTED_STORAGE_KEY,
    '',
    isValidMutedGroups
  );

  const mutedGroups = parseMutedGroups(mutedRaw);

  const groups = NOTIFICATION_GROUPS.filter((group) =>
    LEADERSHIP_NOTIFICATION_KEYS.includes(group.key)
  );

  const toggleNotificationGroup = (key) =>
    setMutedRaw(
      serializeMutedGroups(
        mutedGroups.includes(key)
          ? mutedGroups.filter((muted) => muted !== key)
          : [...mutedGroups, key]
      )
    );

  return (
    // Centred column rather than the full page width every other leadership
    // screen uses: those are tables and dashboards that want the room, while a
    // settings row is a label and one control — stretched across a wide monitor
    // it reads as two unrelated columns. The heading rides in the same column so
    // the two share an edge.
    <div className="mx-auto max-w-3xl space-y-6">
      <SymphonyPageHeader
        kicker="Account"
        title="Settings"
        subtitle="Preferences for your account, appearance and notifications."
      />

      <div className="space-y-3.5">
        <SettingsSection icon={UserRound} title="Account" description="Who you are signed in as.">
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
        </SettingsSection>

        {/* The panel, not a link to `/profile`: leadership has no profile page —
            that route redirects them to `/programme` — so this is the only place
            they can change their own password. */}
        <ChangePasswordPanel />

        <SettingsSection
          icon={Palette}
          title="Appearance"
          description="Theme — saved to your account."
        >
          <SettingsRow label="Theme">
            <ThemeModeControl />
          </SettingsRow>
        </SettingsSection>

        <SettingsSection
          icon={Accessibility}
          title="Accessibility"
          description="Contrast follows your account."
        >
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

        <SettingsSection
          icon={Bell}
          title="Notifications"
          description="What reaches you, and where."
        >
          <DesktopNotificationsRow />

          {groups.map((group) => {
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
        </SettingsSection>
      </div>
    </div>
  );
}
