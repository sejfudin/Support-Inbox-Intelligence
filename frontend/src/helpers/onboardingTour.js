import { isOnOffValue } from '@/hooks/useStoredPreference';

/**
 * The account's own opt-out for the what's-new tour's *automatic* open, set
 * from Settings → Notifications. Independent of `TOUR_ENABLED` (a deploy-time
 * kill switch in `components/onboarding/whatsNewSteps.js`) and of the
 * seen-state (a record of what has already been read, in the same file):
 * turning this off stops the interruption, not the tour — Skip, Escape and the
 * sidebar's replay button all still work regardless.
 *
 * Registered as an account preference in `context/ThemeConfigContext.jsx`
 * (`VALUE_PREFERENCES`), so it syncs the same way `mutedNotificationGroups`
 * does. Read directly with `readStoredPreference` inside the auto-open effect
 * in `WhatsNewTour.jsx` rather than through a reactive hook — see the comment
 * on that effect for why.
 */
export const ONBOARDING_ENABLED_STORAGE_KEY = 'onboarding-tour-enabled';

export const DEFAULT_ONBOARDING_ENABLED = 'on';

export const isValidOnboardingEnabled = isOnOffValue;
