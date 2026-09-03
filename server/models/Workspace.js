const mongoose = require('mongoose');
const { DEFAULT_SPRINT_DAYS, MIN_SPRINT_DAYS, MAX_SPRINT_DAYS } = require('../helpers/sprintRules');

const workspaceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please enter a workspace name'],
      maxlength: [100, 'Workspace name cannot be longer than 100 characters'],
    },
    description: {
      type: String,
      maxlength: [500, 'Description cannot be longer than 500 characters'],
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    logoPath: {
      type: String,
      default: null,
    },

    isArchived: { type: Boolean, default: false },

    // How this workspace runs sprints. Both values only ever feed the DEFAULTS —
    // a sprint someone dates by hand is unaffected, and every window still goes
    // through `validateSprintDates` and the overlap check either way.
    //
    // Bounds are the same one-to-eight-weeks `validateSprintDates` enforces, so
    // a cadence that could never produce a legal sprint cannot be stored. The
    // helpers clamp as well (`clampSprintLength`), because a document written
    // before these bounds existed still has to read back sanely.
    //
    // There is no endpoint that writes this yet — the brief asked for the
    // behaviour, not a settings screen. The field exists so the cadence and the
    // rollover switch are configuration rather than constants in the code.
    sprintSettings: {
      // Whether a finished sprint grows its own successor (ADR 0014). Default on.
      autoRollover: { type: Boolean, default: true },
      lengthDays: {
        type: Number,
        default: DEFAULT_SPRINT_DAYS,
        min: MIN_SPRINT_DAYS,
        max: MAX_SPRINT_DAYS,
      },
    },
    members: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        role: {
          type: String,
          enum: ['admin', 'member'],
          default: 'member',
        },
        status: {
          type: String,
          enum: ['active', 'invited', 'disabled'],
          default: 'invited',
        },
        invitedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        joinedAt: {
          type: Date,
        },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Workspace', workspaceSchema);
