const mongoose = require('mongoose');

/**
 * One unsent New-ticket form, per account per workspace.
 *
 * Not a `Ticket` with a flag: a draft has no task number, no history, no
 * comments, no board column and no readers other than the person typing it, and
 * every ticket query in the app would have to learn to exclude it. Keeping it in
 * its own collection means the ticket side of the app is unaware drafts exist.
 *
 * **One row per (user, workspace)** — the compound unique index below is the
 * whole storage rule. The modal is a single form, so a second draft in the same
 * workspace would be a draft nothing can reopen.
 *
 * Every field is optional and mirrors a control in the modal, including
 * `dueDate` as the input's own `YYYY-MM-DD` string rather than a `Date` — see
 * `helpers/ticketDraftRules.js`.
 */
const ticketDraftSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
    },
    subject: {
      type: String,
      trim: true,
      maxlength: 100,
      default: '',
    },
    description: {
      type: String,
      default: '',
    },
    status: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TicketStatus',
      default: null,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
    storyPoints: {
      type: Number,
      min: 1,
      max: 5,
      default: null,
    },
    assignedTo: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    dueDate: {
      type: String,
      default: '',
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    blockedBy: {
      ticket: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Ticket',
        default: null,
      },
      note: {
        type: String,
        trim: true,
        maxlength: 500,
        default: '',
      },
    },
  },
  { timestamps: true }
);

ticketDraftSchema.index({ user: 1, workspace: 1 }, { unique: true });

module.exports = mongoose.model('TicketDraft', ticketDraftSchema);
