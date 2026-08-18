const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    senderType: {
      type: String,
      enum: ['admin', 'user'],
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    text: {
      type: String,
      required: [true, 'Message text is required'],
    },
  },
  {
    timestamps: true,
  }
);

const aiAssistantSchema = new mongoose.Schema(
  {
    summary: { type: String, default: '' },
    category: {
      type: String,
      enum: ['billing', 'bug', 'feature', 'other', ''],
      default: '',
    },
    suggestedReply: { type: String, default: '' },
    confidenceScore: {
      type: Number,
      min: 0,
      max: 1,
      default: 0,
    },
  },
  {
    timestamps: true,
    _id: false,
  }
);

const ticketSchema = new mongoose.Schema(
  {
    subject: {
      type: String,
      required: [true, 'Please provide a ticket subject'],
      trim: true,
      maxlength: [100, 'Title cannot be more than 100 characters'],
    },
    description: {
      type: String,
    },
    status: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TicketStatus',
      required: true,
    },
    priority: {
      type: String,
      enum: {
        values: ['low', 'medium', 'high', 'critical'],
        message: '{VALUE} is not a supported priority',
      },
      default: 'medium',
      required: true,
    },
    storyPoints: {
      type: Number,
      min: 1,
      max: 5,
      default: null,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
    messages: [messageSchema],
    ai: aiAssistantSchema,
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    assignedTo: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
    },
    totalTimeSpent: {
      type: Number,
      default: 0,
    },
    inProgressAt: {
      type: Date,
    },
    doneAt: {
      type: Date,
    },
    taskNumber: {
      type: Number,
      immutable: true,
      index: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    // Why this ticket can't move, recorded while it sits in the Blocked status.
    // Both halves are optional and independent: `ticket` is another ticket in the
    // SAME workspace (enforced in `ticketService`, same rule as `category`), and
    // `note` covers the case where nothing on the board is the blocker. Cleared
    // when the ticket leaves Blocked — see `helpers/ticketBlocker.js`.
    blockedBy: {
      ticket: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Ticket',
        default: null,
      },
      note: {
        type: String,
        trim: true,
        maxlength: [500, 'Blocker note cannot be more than 500 characters'],
        default: '',
      },
    },
    linkedPullRequest: {
      type: {
        prNumber: {
          type: Number,
          required: true,
        },
        prTitle: {
          type: String,
          required: true,
        },
        branchName: {
          type: String,
          required: true,
        },
        state: {
          type: String,
          enum: ['open', 'closed', 'merged'],
          required: true,
        },
        isDraft: {
          type: Boolean,
          default: false,
        },
        author: {
          login: String,
          avatarUrl: String,
        },
        url: String,
        createdAt: Date,
        updatedAt: Date,
        mergedAt: Date,
        mergedBy: {
          login: String,
          avatarUrl: String,
        },
      },
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

ticketSchema.set('toJSON', { virtuals: true });
ticketSchema.set('toObject', { virtuals: true });

ticketSchema.index({ status: 1, updatedAt: -1 });
ticketSchema.index({ isArchived: 1, updatedAt: -1 });
// The Archive page's default order: one workspace's archived tickets, most
// recently archived first. Tickets archived before `archivedAt` existed simply
// have no value for it — the service sorts those through an `$ifNull` fallback
// rather than a migration, so this index is a read optimisation, not a contract.
ticketSchema.index({ workspace: 1, isArchived: 1, archivedAt: -1 });
ticketSchema.index({ workspace: 1, taskNumber: 1 });
ticketSchema.index({ 'linkedPullRequest.prNumber': 1, workspace: 1 });
module.exports = mongoose.model('Ticket', ticketSchema);
