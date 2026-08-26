const mongoose = require('mongoose');
const { ROLE_VALUES } = require('../constants/roles');
const {
  USER_PREFERENCE_DEFINITIONS,
  USER_LIST_PREFERENCE_DEFINITIONS,
} = require('../constants/userPreferences');

/**
 * One subdocument rather than a field per checkbox: the list of UI preferences
 * grows every time Settings gains a row, and `User` should not grow with it.
 * Every field is optional — an absent one means "never chosen", and the service
 * fills it from `DEFAULT_USER_PREFERENCES` on read.
 *
 * UI scale is intentionally not here; it stays per-device. See
 * `server/constants/userPreferences.js`.
 */
const userPreferencesSchema = new mongoose.Schema(
  {
    ...Object.fromEntries(
      Object.entries(USER_PREFERENCE_DEFINITIONS).map(([key, definition]) => [
        key,
        { type: String, enum: definition.values },
      ])
    ),
    // Every list-valued preference, built from the same table the service
    // validates against. `default: undefined` on each is load-bearing, not
    // decoration: presence is how `storedKeysOf` tells "the user chose this"
    // from "never touched", and a schema default would make every account look
    // like it had picked an order it never dragged.
    ...Object.fromEntries(
      Object.entries(USER_LIST_PREFERENCE_DEFINITIONS).map(([key, definition]) => [
        key,
        { type: [{ type: String, enum: definition.values }], default: undefined },
      ])
    ),
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    fullname: {
      type: String,
      required: [true, 'Please enter your full name'],
      maxlength: [50, 'Name cannot be longer than 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Please enter your email'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,})+$/, 'Please enter a valid email address'],
    },
    password: {
      type: String,
      minlength: [6, 'Password must have at least 6 characters.'],
      select: false,
      required: function () {
        return this.active === true;
      },
    },
    role: {
      type: String,
      enum: {
        values: ROLE_VALUES,
        message: 'Invalid role',
      },
      required: [true, 'Role is required'],
      default: 'admin',
    },
    active: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['active', 'invited', 'disabled'],
      default: 'invited',
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
    inviteTokenHash: {
      type: String,
      index: true,
    },
    inviteTokenExpires: {
      type: Date,
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    invitedAt: {
      type: Date,
    },
    inviteAcceptedAt: {
      type: Date,
    },
    inviteSetupSessionHash: {
      type: String,
      index: true,
    },
    inviteSetupSessionExpires: {
      type: Date,
    },
    passwordSetAt: {
      type: Date,
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
    },
    hub: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hub',
    },
    // An internal QA account (mentor/leadership, usually) that must log in and
    // work exactly like a real one, but never appear in a listing meant for real
    // users — mentor pickers, the mentor-notes audience picker, staffing-request
    // resolvers, and so on. Same idiom as `Project.isSystem`: a boolean excluded
    // with `{ $ne: true }` at each listing query, not a separate role or a
    // read-side post-filter. `adminService.getUsers` is the one choke point most
    // of those listings already share; see its `includeTestAccounts` param for
    // the one deliberate exception (Platform Management's "All Users", where an
    // admin manages the account itself).
    isTestAccount: {
      type: Boolean,
      default: false,
    },
    // The single "Deleted user" placeholder every ref left behind by a deleted
    // account points at. There is exactly one, created and maintained by
    // `npm run migrate:tombstone-user-refs`.
    //
    // It exists because a departed user cannot simply be erased from the records
    // they touched. A Ticket has `creator: { required: true }`, a Workspace has
    // `owner: { required: true }` — `$unset` on those succeeds through
    // `updateMany` (no validators) and leaves a document that can never be saved
    // through the app again, still rendering as nothing on screen. Deleting the
    // ticket instead would delete other people's conversation. So the ref gets a
    // subject that really exists and is honestly labelled, `populate` resolves,
    // and no `|| 'Unknown'` fallback fires anywhere.
    //
    // Not a login: `active: false` and no password, and `authService.login`
    // rejects on either. Not a person, so it is excluded from every listing a
    // human picks from — same `{ $ne: true }` idiom as `isTestAccount` directly
    // above, shared through `constants/userVisibility.js`. Unlike a test account
    // it has no "include it anyway" escape hatch: there is nothing to administer.
    isTombstone: {
      type: Boolean,
      default: false,
    },
    // Profile picture. Two fields rather than one, on purpose.
    //
    // `avatarUrl` is the public URL, denormalised so that it can ride along in
    // the ordinary user projection (`constants/userSelect.js`). A Mongoose
    // virtual would have been tidier, but virtuals do not survive `.lean()` and
    // roughly forty-six of the queries that populate a user are lean — the
    // avatar would have appeared on some screens and silently vanished on
    // others, which is the one failure mode this feature cannot have.
    //
    // `avatarPath` is the storage key, kept because deleting the old object on
    // replace needs it, and `select: false` so it is never handed to a client by
    // accident. The two write paths that need it ask for it explicitly.
    //
    // If `SUPABASE_URL` or the bucket ever changes, stored URLs go stale; the
    // path is what makes re-deriving them a one-line script rather than a
    // re-upload.
    avatarUrl: {
      type: String,
      default: null,
    },
    avatarPath: {
      type: String,
      default: null,
      select: false,
    },

    // When this viewer last opened the staffing-requests area — drives the
    // news badge (unset means "never opened", not "caught up").
    staffingRequestsLastSeenAt: {
      type: Date,
    },
    // The `TOUR_VERSION` of the what's-new tour this account has finished (or
    // escaped out of). `null` means "never seen one", which is what makes a
    // fresh account get the announcement.
    //
    // The version string rather than a boolean, because the tour is the release
    // channel: bumping `TOUR_VERSION` in
    // `frontend/src/components/onboarding/whatsNewSteps.js` re-announces to
    // everyone exactly once, and a boolean would ship the tour once ever and
    // silently retire that mechanism.
    //
    // A top-level field rather than a row in `preferences`, on purpose. That
    // subdocument validates every write against an enum of legal values
    // (`constants/userPreferences.js`), and a release string has no such list —
    // it would need a branch through a validator whose whole contract is "a
    // value from this table". This is the same shape as
    // `staffingRequestsLastSeenAt` directly above: a marker the app writes,
    // not a setting the user picks.
    //
    // Not `select: false`, and that is the load-bearing part: `getMe` spreads
    // the whole user document, so this arrives on the payload the shell already
    // waits for. The tour is already gated on having a user, so the seen-state
    // needs no query and no hydration gate of its own.
    whatsNewSeenVersion: {
      type: String,
      default: null,
    },
    // Appearance / workspace-default / notification preferences that follow the
    // account across browsers. Read and written through
    // `GET|PATCH /api/users/me/preferences`.
    preferences: {
      type: userPreferencesSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  }
);

userSchema.index({ active: 1, updatedAt: -1 });
module.exports = mongoose.model('User', userSchema);
