import {
  Briefcase,
  Building2,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarX,
  ClipboardCheck,
  Compass,
  FolderPlus,
  Gauge,
  GraduationCap,
  LayoutGrid,
  MessageSquarePlus,
  Newspaper,
  Send,
  SquarePen,
  UserPlus,
  Users,
} from 'lucide-react';

import { ROLES } from './roles';

/**
 * The dashboard quick actions: one declaration, every role that has a card.
 *
 * Lives here rather than in `QuickActionsCard.jsx` so the ordering logic below
 * can be unit-tested without a render — the card is then a pure function of the
 * rows it is handed.
 *
 * A row is one of three kinds, unchanged from the original card:
 *
 * - `to` — navigates.
 * - `opens` — the dashboard page owns a single `openAction` state and raises the
 *   matching modal, so two can never be open at once. Adding one means adding
 *   the modal on the page that renders the card.
 * - `pending` — not built yet, and says so out loud rather than silently doing
 *   nothing. There is exactly one, and it should stay that way: a second
 *   makes "Soon" a pattern instead of an admission.
 *
 * `roles` is what makes one catalog serve several dashboards. It is a **display**
 * filter and nothing more — every action's target keeps its own server guard, so
 * a row reaching the wrong role would be a cosmetic bug, not an escalation.
 *
 * Which rows a mentor gets is not a guess — it follows what the product actually
 * allows today, and three of the four limits are stated somewhere other than a
 * route file:
 *
 * - **Readiness is admin-only.** `readinessFlagService.upsertReadinessFlag`
 *   throws 403 for anyone who is not an admin, even an assigned mentor.
 *   (`ROLE_OPTIONS` in `roles.js` still tells mentors they "set readiness" — that
 *   copy predates the guard.)
 * - **Recommending is admin-only.** `POST /api/recommendations` is
 *   `requireRole(ADMIN)`, and `MentorRecommendationsPage` — despite its name — is
 *   mounted inside the admin-only route block.
 * - **Evaluations are admin-only by decision**, which is the subtle one: the
 *   *service* would let an assigned mentor write one (`canWriteMentorData`), but
 *   `InternEvaluationsPanel` gates on `role === ADMIN` and `TEAM_HANDBOOK.md`
 *   says evaluations are admin-only. A mentor row here would contradict the
 *   handbook while the server quietly allowed it.
 * - **Mentors cannot create workspaces**, per the handbook — even though
 *   `POST /api/workspaces` still accepts `MENTOR`. Another place to trust the
 *   handbook over the route.
 *
 * Mentor notes are the one shared write: `canWriteMentorData` on the server,
 * `canWriteInternMentorData` on the client, and the handbook says so too.
 *
 * Keep the keys in step with `QUICK_ACTION_KEYS` in
 * `server/constants/userPreferences.js` — that is what the stored order is
 * validated against.
 */
export const QUICK_ACTION_CATALOG = Object.freeze([
  {
    key: 'assign-ticket',
    label: 'Assign a ticket',
    icon: ClipboardCheck,
    roles: [ROLES.ADMIN, ROLES.MENTOR],
    opens: true,
  },
  {
    key: 'absence-requests',
    label: 'Review absence requests',
    icon: CalendarClock,
    roles: [ROLES.ADMIN],
    to: '/admin/absence-requests',
  },
  {
    key: 'staffing-requests',
    label: 'Review staffing requests',
    icon: Briefcase,
    roles: [ROLES.ADMIN],
    to: '/admin/staffing-requests',
  },
  {
    key: 'recommend-intern',
    label: 'Recommend intern',
    icon: Send,
    roles: [ROLES.ADMIN],
    opens: true,
  },
  {
    key: 'write-evaluation',
    label: 'Write evaluation',
    icon: SquarePen,
    roles: [ROLES.ADMIN],
    opens: true,
  },
  {
    key: 'write-note',
    label: 'Write a note',
    icon: MessageSquarePlus,
    roles: [ROLES.ADMIN, ROLES.MENTOR],
    opens: true,
  },
  {
    key: 'update-readiness',
    label: 'Update technology readiness',
    icon: Gauge,
    roles: [ROLES.ADMIN],
    opens: true,
  },
  {
    // The Specialization page's own `AssignSpecializationModal`, raised here — it
    // carries its own picker of unspecialized candidates and the mentor pairing,
    // so it needs no `InternPickerModal` stage in front of it.
    key: 'assign-specialization',
    label: 'New specialization',
    icon: Compass,
    roles: [ROLES.ADMIN],
    opens: true,
  },
  {
    // `POST /api/projects` is admin-only, but `/projects` is mounted
    // leadership-only — so before this, an admin's only way to create one was
    // Platform Management. Same dialog, raised from here.
    key: 'add-project',
    label: 'Add project',
    icon: FolderPlus,
    roles: [ROLES.ADMIN],
    opens: true,
  },
  {
    key: 'add-intern',
    label: 'Add intern',
    icon: UserPlus,
    roles: [ROLES.ADMIN],
    to: '/register',
  },
  {
    // A dialog, not the roster page: the question is a glance — who is in, who is
    // away, who has not checked in — and the dashboard payload already answers
    // it. The roster page is still where a month or another day live.
    key: 'attendance-today',
    label: 'Attendance today',
    icon: CalendarCheck,
    roles: [ROLES.ADMIN],
    opens: true,
  },
  {
    key: 'daily-insights',
    label: 'Daily insights',
    icon: Newspaper,
    roles: [ROLES.ADMIN],
    to: '/admin/daily-insights',
  },
  {
    key: 'manage-users',
    label: 'Manage users',
    icon: Users,
    roles: [ROLES.ADMIN],
    to: '/admin/users',
  },
  {
    // NOT `/create-workspace`: that page is the *first-workspace* flow, and
    // `AppRoutes.jsx` redirects an admin who already has a workspace from it
    // straight back to the dashboard — so the action looked like it did nothing.
    // The workspaces list owns the create dialog, and `?new=1` opens it.
    key: 'new-workspace',
    label: 'New workspace',
    icon: Building2,
    roles: [ROLES.ADMIN],
    to: '/admin/workspaces?new=1',
  },
  {
    // The Attendance model has no write path for absence at all: only interns may
    // check in (`POST /api/attendance/me/check-in` is intern-guarded), absence is
    // the *lack* of a record, and `POST /api/absence-requests/me` is intern-only
    // too — so an admin cannot even file on someone's behalf. This needs a
    // backend change, not a modal.
    key: 'mark-absence',
    label: 'Mark absence / excuse',
    icon: CalendarX,
    roles: [ROLES.ADMIN],
    pending: true,
  },

  // Mentor-only rows. Nothing renders them yet: the mentor's `/dashboard` is
  // still `UserDashboard.jsx`, the pre-overhaul assigned-tickets table, with no
  // rail to hang a card on. They are declared now so the rebuild mounts the card
  // instead of inventing a second list.
  //
  // One thing that rebuild has to supply: `InternPickerModal` on the admin
  // dashboard lists the workspace's interns. A mentor's card needs a picker
  // scoped to *their* interns, or every `opens` row above ends in a 403 they
  // could not have predicted.
  {
    key: 'my-interns',
    label: 'My interns',
    icon: GraduationCap,
    roles: [ROLES.MENTOR],
    to: '/my-interns',
  },
  {
    key: 'workspace-dailies',
    label: "Today's daily",
    icon: CalendarDays,
    roles: [ROLES.MENTOR],
    to: '/dailies',
  },
  {
    key: 'my-workspaces',
    label: 'My workspaces',
    icon: LayoutGrid,
    roles: [ROLES.MENTOR],
    to: '/workspaces',
  },
]);

/* ==========================================================================
 * TODO(quick-actions): PUT THE CAP BACK TO 5 BEFORE THIS SHIPS.
 *
 * ⚠️  `QUICK_ACTIONS_MAX` is `null` — NO LIMIT — and that is **not** the intended
 *     behaviour. It was turned off deliberately and temporarily so that every
 *     action could be put on the card at once and tested one by one.
 *
 *     The dashboard card is a rail card beside the standup: **five rows is the
 *     design**, and an admin can currently pile all fifteen onto it, which will
 *     push the standup card down and break the two-column row that is meant to
 *     end level.
 *
 * TO RE-ARM IT — two lines, nothing else:
 *   1. here:   export const QUICK_ACTIONS_MAX = 5;
 *   2. server: `QUICK_ACTIONS_MAX` in `server/constants/userPreferences.js`
 *              (it feeds `maxLength`, which is what refuses an over-long PATCH).
 *
 * Everything downstream is already written for it and comes back on its own: the
 * editor's `n / 5` counter, its "Full — take one off to make room" hint, the
 * refusal toast on a sixth drop, this module's validation (which is what stops
 * the editor caching a sixth), and the server's 400. `grep -rn "QUICK_ACTIONS_MAX"`
 * finds every site. The tests pass a cap explicitly, so they pin both behaviours
 * and will not need editing either.
 * ========================================================================== */
export const QUICK_ACTIONS_MAX = null;

/**
 * The list is a **selection** whether or not the cap is armed: an account picks
 * the actions it wants and the rest are simply not on the dashboard. Everything
 * in the catalog is reachable from the sidebar regardless, which is what makes
 * leaving one out cheap.
 */

/**
 * How many the card opens with for an account that has never chosen. Separate
 * from the cap, because it is a different question: this is "what is a sensible
 * card out of the box", not "how many will fit".
 */
export const QUICK_ACTIONS_DEFAULT_COUNT = 5;

/**
 * Cached as one comma-separated string and stored on the user as a real array —
 * the same shape as `notify-muted`, for the same reason (see
 * `helpers/notificationPreferences.js`).
 *
 * Three states, and they are all distinct, which is why the sentinel exists:
 *
 * | cached      | stored     | means                                    |
 * |-------------|------------|------------------------------------------|
 * | `''`        | *absent*   | never chosen — show the shipped default  |
 * | `'none'`    | `[]`       | chose to have no quick actions at all    |
 * | `'a,b,c'`   | `['a',…]`  | chose these, in this order               |
 *
 * `''` cannot carry "none" because `readStoredPreference` treats an empty cached
 * value as "nothing cached" and hands back the fallback — so removing the last
 * action would snap the card back to five defaults and read as a bug. Hence a
 * word that can never be an action key.
 */
export const QUICK_ACTIONS_STORAGE_KEY = 'quick-actions-order';

/** Not a catalog key, and it never can be — every key names a thing to do. */
export const QUICK_ACTIONS_NONE = 'none';

const CATALOG_KEYS = QUICK_ACTION_CATALOG.map((action) => action.key);

/**
 * The cached string as an intent.
 *
 * @returns {string[]|null} the chosen keys (possibly empty), or `null` for
 *   "never chosen" — which is not the same thing and must not be flattened into it.
 */
export const decodeQuickActionSelection = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (value === QUICK_ACTIONS_NONE) return [];
  return String(value)
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean);
};

/** The inverse. An empty selection encodes to the sentinel, never to `''`. */
export const encodeQuickActionSelection = (keys) => {
  if (!Array.isArray(keys)) return '';
  return keys.length === 0 ? QUICK_ACTIONS_NONE : keys.join(',');
};

/**
 * A cached string is usable only if it names real actions and stays inside the
 * cap. Both matter: `useStoredPreference` refuses to write a value that fails
 * this, so it is also what stops the editor from saving past the cap, and what
 * makes a cache left by an older build (or hand-edited) fall back to the default
 * instead of rendering something impossible.
 */
export const isValidQuickActionOrder = (value, max = QUICK_ACTIONS_MAX) => {
  const selection = decodeQuickActionSelection(value);
  if (selection === null) return true;
  if (max && selection.length > max) return false;
  return selection.every((key) => CATALOG_KEYS.includes(key));
};

/** Every action this role may see, in catalog order. */
export const quickActionsForRole = (role, catalog = QUICK_ACTION_CATALOG) =>
  catalog.filter((action) => action.roles.includes(role));

/**
 * What the card draws: the account's chosen actions, or the shipped default.
 *
 * Keys are stored and resolved on read, never a snapshot of the resolved rows:
 *
 * - **Never chosen** (`null`) → the first `QUICK_ACTIONS_DEFAULT_COUNT` of the
 *   role's catalog. So the shipped default is whatever the catalog says today,
 *   and re-ordering the catalog in a later release still reaches everyone who has
 *   not made a choice of their own.
 * - **Chosen** → exactly those, in that order. An action added in a later release
 *   does *not* force its way in: those slots were picked deliberately, and quietly
 *   evicting one of them would be worse than not showing the newcomer. The
 *   Settings editor is where it gets noticed.
 * - An action **retired** since, or one **this role cannot use**, is dropped
 *   without disturbing the rest — which is what makes a role change need no
 *   migration. A selection that ends up empty that way reads as "none chosen",
 *   and the card says so rather than rendering somebody else's actions.
 * - A key **repeated** keeps its first position, matching the server's own
 *   de-duplication of the same list.
 *
 * @param {string[]|null} selection from `decodeQuickActionSelection`
 * @param {string} role the viewer's platform role
 * @param {Array} [catalog] injectable for tests
 * @param {number|null} [max] the cap; injectable so the tests can pin both
 *   behaviours whichever way the constant is currently set
 */
export const resolveQuickActions = (
  selection,
  role,
  catalog = QUICK_ACTION_CATALOG,
  max = QUICK_ACTIONS_MAX
) => {
  const allowed = quickActionsForRole(role, catalog);

  if (selection === null || selection === undefined) {
    return allowed.slice(0, QUICK_ACTIONS_DEFAULT_COUNT);
  }

  const byKey = new Map(allowed.map((action) => [action.key, action]));
  const placed = new Set();
  const chosen = [];

  (Array.isArray(selection) ? selection : []).forEach((key) => {
    const action = byKey.get(key);
    if (!action || placed.has(key)) return;
    placed.add(key);
    chosen.push(action);
  });

  return max ? chosen.slice(0, max) : chosen;
};

/**
 * The rest of the role's catalog — what the Settings editor offers to add.
 * Catalog order, so the menu reads the same for everyone.
 */
export const availableQuickActions = (selection, role, catalog = QUICK_ACTION_CATALOG) => {
  const chosen = new Set(resolveQuickActions(selection, role, catalog).map((action) => action.key));
  return quickActionsForRole(role, catalog).filter((action) => !chosen.has(action.key));
};
