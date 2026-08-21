import { useEffect, useState } from 'react';

import { SettingsRow } from '@/components/settings/SettingsSection';
import { Switch } from '@/components/ui/switch';
import {
  DESKTOP_NOTIFICATIONS_DEFAULT,
  DESKTOP_NOTIFICATIONS_STORAGE_KEY,
  desktopNotificationsValue,
  getDesktopPermission,
  isDesktopNotificationSupported,
  isDesktopNotificationsOn,
  isValidDesktopNotifications,
  requestDesktopPermission,
} from '@/helpers/desktopNotifications';
import { useStoredPreference } from '@/hooks/useStoredPreference';

const HINT = {
  granted: 'A banner outside the browser when something arrives and this tab is in the background.',
  default:
    'A banner outside the browser when something arrives and this tab is in the background. Your browser will ask once.',
  denied:
    'Your browser is blocking notifications for this site. Allow them in its site settings to switch this on.',
};

/**
 * The one row in Settings that is not purely ours: it also carries the
 * browser's permission, which lives outside React and outside the account.
 *
 * Kept in its own component because of that — the row needs a mount read, a
 * focus listener and an async click handler, none of which the mute switches
 * beside it need.
 */
export default function DesktopNotificationsRow() {
  const [stored, setStored] = useStoredPreference(
    DESKTOP_NOTIFICATIONS_STORAGE_KEY,
    DESKTOP_NOTIFICATIONS_DEFAULT,
    isValidDesktopNotifications
  );

  const [permission, setPermission] = useState('default');
  const [supported, setSupported] = useState(true);

  // Permission changes without telling us — the reader can revoke it in site
  // settings mid-session. Nothing fires an event, so re-read when they come
  // back to the tab. Reading in an effect, not in a `useState` initialiser,
  // keeps the first render the same for everyone (see `useStoredPreference`).
  useEffect(() => {
    const sync = () => {
      setSupported(isDesktopNotificationSupported());
      setPermission(getDesktopPermission());
    };

    sync();
    window.addEventListener('focus', sync);

    return () => window.removeEventListener('focus', sync);
  }, []);

  // Permission lost since the switch was stored — revoked in site settings, or
  // denied at the prompt. Clear our half too, so the stored value never says
  // "on" for something that cannot draw. Without this, re-granting in the
  // browser would silently resume banners the reader never re-consented to in
  // the app.
  useEffect(() => {
    if (permission !== 'granted' && isDesktopNotificationsOn(stored)) {
      setStored(desktopNotificationsValue(false));
    }
  }, [permission, stored, setStored]);

  // No API to drive: a row that could never do anything is worse than no row.
  if (!supported) return null;

  const denied = permission === 'denied';
  const checked = isDesktopNotificationsOn(stored) && permission === 'granted';

  const onCheckedChange = async (next) => {
    if (!next) {
      // Only our switch. Browser permission is the reader's to revoke, and
      // dropping it here would cost them the prompt on the way back — a denied
      // browser never asks again.
      setStored(desktopNotificationsValue(false));
      return;
    }

    // Runs from a click, which is the gesture the browser requires before it
    // will show the prompt at all.
    const result = await requestDesktopPermission();
    setPermission(getDesktopPermission());

    // Store "on" only once it can actually draw. A switch left reading "on"
    // after a refusal would promise banners that never come.
    if (result === 'granted') setStored(desktopNotificationsValue(true));
  };

  return (
    <SettingsRow
      label="Desktop notifications"
      hint={denied ? HINT.denied : HINT[permission]}
      // Anchor for the what's-new tour. Note the `!supported` early return above:
      // in a browser with no Notification API this row does not render, and the
      // tour step falls back to a centred card rather than pointing at nothing.
      tour="settings-desktop-notifications"
    >
      <Switch
        checked={checked}
        disabled={denied}
        onCheckedChange={onCheckedChange}
        aria-label="Desktop notifications"
        data-test="settings-notify-desktop-switch"
      />
    </SettingsRow>
  );
}
