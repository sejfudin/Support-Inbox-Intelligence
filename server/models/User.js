const mongoose = require('mongoose');
const { ROLE_VALUES } = require('../constants/roles');
const {
  USER_PREFERENCE_DEFINITIONS,
  MUTED_NOTIFICATION_GROUP_VALUES,
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
    mutedNotificationGroups: {
      type: [{ type: String, enum: MUTED_NOTIFICATION_GROUP_VALUES }],
      default: undefined,
    },
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
    // When this viewer last opened the staffing-requests area — drives the
    // news badge (unset means "never opened", not "caught up").
    staffingRequestsLastSeenAt: {
      type: Date,
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
