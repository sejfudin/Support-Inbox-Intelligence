/**
 * UI preferences: the key, the options and the guard for each one, in a single
 * place so Settings and the screen that obeys the preference can never disagree
 * about what a valid value is.
 *
 * **Where they live.** All but one follow the *account*: the `preferences`
 * subdocument on `server/models/User.js` is the source of truth and
 * `localStorage` is a write-through cache in front of it, because a server round
 * trip cannot beat the first paint. Which of them is which is declared by the
 * `scope` column of the tables in `context/ThemeConfigContext.jsx` — that file,
 * not this one, is the place that knows.
 *
 * The one exception is **UI scale**, which stays per-device. See the comment on
 * its row over there.
 */

// ── Density ────────────────────────────────────────────────────────────────
// Applied as `data-density` on <html> by `ThemeConfigProvider`; `index.css`
// keys the tighter table metrics off it.

export const DENSITY_STORAGE_KEY = 'ui-density';

export const DEFAULT_DENSITY = 'comfortable';

export const DENSITY_OPTIONS = [
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'compact', label: 'Compact' },
];

export const isValidDensity = (value) => DENSITY_OPTIONS.some((o) => o.value === value);

// ── Accessibility ──────────────────────────────────────────────────────────
// All four are attributes on <html>, applied by `ThemeConfigProvider` and read
// by the `[data-…]` blocks in `index.css`. Attributes rather than classes so a
// value is legible in devtools and only one can be active at a time.

// The one preference that never leaves this browser: it answers to physical
// screen size and viewing distance rather than to taste, so a 13" laptop and a
// 27" monitor genuinely want different values and syncing it would make one of
// them wrong. See the `scope` column in `context/ThemeConfigContext.jsx`.
export const UI_SCALE_STORAGE_KEY = 'ui-scale';

export const DEFAULT_UI_SCALE = 'default';

// Applied as `zoom` on <body>, which is the only mechanism that actually moves
// this app: nearly every size in the design is a px literal, so a root
// `font-size` change would scale the handful of rem values and nothing else.
export const UI_SCALE_OPTIONS = [
  { value: 'default', label: '100%' },
  { value: 'large', label: '110%' },
  { value: 'larger', label: '125%' },
];

export const isValidUiScale = (value) => UI_SCALE_OPTIONS.some((o) => o.value === value);

export const CONTRAST_STORAGE_KEY = 'ui-contrast';

export const DEFAULT_CONTRAST = 'default';

export const CONTRAST_OPTIONS = [
  { value: 'default', label: 'Default' },
  { value: 'high', label: 'High' },
];

export const isValidContrast = (value) => CONTRAST_OPTIONS.some((o) => o.value === value);

export const MOTION_STORAGE_KEY = 'ui-motion';

export const DEFAULT_MOTION = 'full';

export const MOTION_OPTIONS = [
  { value: 'full', label: 'Full' },
  { value: 'reduced', label: 'Reduced' },
];

export const isValidMotion = (value) => MOTION_OPTIONS.some((o) => o.value === value);

export const COLORBLIND_STORAGE_KEY = 'ui-colorblind';

export const DEFAULT_COLORBLIND = 'off';

/**
 * The three families of colour vision deficiency, each with its own repaint of
 * the status tones in `index.css`:
 *
 * - `redgreen` — deuteranomaly, deuteranopia, protanomaly, protanopia. Reds,
 *   greens, browns and oranges collide, so the tones move to Okabe–Ito.
 * - `blueyellow` — tritanopia and tritanomaly. Blue reads greenish and yellow
 *   reads pink, so the palette leans on the red–green axis these viewers keep.
 * - `grayscale` — achromatopsia. No hue survives, so the tones separate by
 *   lightness alone and the chip labels do the rest of the work.
 */
export const COLORBLIND_OPTIONS = [
  { value: 'off', label: 'Off' },
  { value: 'redgreen', label: 'Red–green' },
  { value: 'blueyellow', label: 'Blue–yellow' },
  { value: 'grayscale', label: 'Complete' },
];

export const isValidColorblind = (value) => COLORBLIND_OPTIONS.some((o) => o.value === value);

// ── Tickets view ───────────────────────────────────────────────────────────
// Which of the two ticket surfaces opens when you arrive without a `?view=`
// param. Written by the toggle on the Tickets page itself, so the preference is
// a record of what you actually use rather than a setting you have to find.
// Account-scoped, so the toggle also travels to your other browsers.

export const TICKETS_VIEW_STORAGE_KEY = 'tickets-view';

export const DEFAULT_TICKETS_VIEW = 'list';

export const TICKETS_VIEW_OPTIONS = [
  { value: 'list', label: 'List' },
  { value: 'board', label: 'Board' },
];

export const isValidTicketsView = (value) => TICKETS_VIEW_OPTIONS.some((o) => o.value === value);

// ── Sidebar sections ───────────────────────────────────────────────────────
// How the sidebar groups its nav rows. `labelled` — the default — is the plain
// captioned list with every group always open, which is the sidebar this app shipped
// with. `collapsible` gives each group a header row that opens and closes, navigates
// to the group's first page, and peeks on hover.
//
// Account-scoped, unlike `nav-sections-closed` (which sections you have actually
// closed — see `helpers/navSections.js`). The two are deliberately different
// scopes: *whether you want collapsing at all* is taste and follows you, while
// *which groups you collapsed* is a function of how much vertical room this screen
// has and stays on the device.
//
// Switching to `labelled` does not clear the closed list — turn collapsing back on
// and your sections are where you left them.

export const NAV_STYLE_STORAGE_KEY = 'nav-style';

export const DEFAULT_NAV_STYLE = 'labelled';

// Default first, which is also the order the segmented control renders in.
export const NAV_STYLE_OPTIONS = [
  { value: 'labelled', label: 'Labelled' },
  { value: 'collapsible', label: 'Collapsible' },
];

export const isValidNavStyle = (value) => NAV_STYLE_OPTIONS.some((o) => o.value === value);

// ── Landing page ───────────────────────────────────────────────────────────
// Where `/` sends you. `routes/AppRoutes.jsx` honours it only when the account
// can actually reach the target — leadership keeps its own home, and every
// option but Dashboard needs an active workspace.

export const LANDING_PAGE_STORAGE_KEY = 'landing-page';

export const DEFAULT_LANDING_PAGE = 'dashboard';

export const LANDING_PAGE_OPTIONS = [
  { value: 'dashboard', label: 'Dashboard', path: '/dashboard', needsWorkspace: false },
  { value: 'tickets', label: 'Tickets', path: '/tickets', needsWorkspace: true },
  { value: 'board', label: 'Board', path: '/tickets?view=board', needsWorkspace: true },
  { value: 'dailies', label: 'Dailies', path: '/dailies', needsWorkspace: true },
];

export const isValidLandingPage = (value) => LANDING_PAGE_OPTIONS.some((o) => o.value === value);

export const landingPageEntry = (value) =>
  LANDING_PAGE_OPTIONS.find((o) => o.value === value) ?? LANDING_PAGE_OPTIONS[0];

// ── Default assignee filter ────────────────────────────────────────────────
// Seeds the Tickets assignee filter when the link carries no `?assignee=`.

export const ASSIGNEE_DEFAULT_STORAGE_KEY = 'tickets-assignee-default';

export const DEFAULT_ASSIGNEE_DEFAULT = 'everyone';

export const ASSIGNEE_DEFAULT_OPTIONS = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'me', label: 'Assigned to me' },
];

export const isValidAssigneeDefault = (value) =>
  ASSIGNEE_DEFAULT_OPTIONS.some((o) => o.value === value);
