import { isOnOffValue } from '@/hooks/useStoredPreference';

/**
 * Whether the app is allowed to point at unread release news: the glow on the
 * sidebar's What's new button and the NEW pills beside the nav rows a release
 * added. Set from Settings → Notifications.
 *
 * It used to gate the tour's *automatic* open, which is where the storage key's
 * name comes from — the tour opened itself once per release and this was the way
 * to stop it. Nothing opens itself now (see
 * `components/onboarding/whatsNewSteps.js`), so what is left to opt out of is the
 * attention, not the interruption: with this off, the button is still there and
 * still opens the same tour, it just stops asking to be clicked.
 *
 * **The stored key and the server's preference name are deliberately unchanged**
 * (`onboarding-tour-enabled` / `onboardingTourEnabled`). They are values already
 * written to every account that has touched the switch, and renaming a key to
 * match a relabelled row would silently reset each of those accounts to the
 * default. The identifiers here say what the preference now does; the wire format
 * says what it has always been called.
 *
 * Independent of `TOUR_ENABLED` (a deploy-time kill switch) and of the seen-state
 * (a record of what has already been read), both in the same file.
 *
 * Registered as an account preference in `context/ThemeConfigContext.jsx`
 * (`VALUE_PREFERENCES`), so it syncs the same way `mutedNotificationGroups` does.
 * Read through `useWhatsNewHighlight`, which owns the one-frame-flash reasoning
 * for why it is not read through `useStoredPreference`.
 */
export const ONBOARDING_HIGHLIGHT_STORAGE_KEY = 'onboarding-tour-enabled';

export const DEFAULT_ONBOARDING_HIGHLIGHT = 'on';

export const isValidOnboardingHighlight = isOnOffValue;
