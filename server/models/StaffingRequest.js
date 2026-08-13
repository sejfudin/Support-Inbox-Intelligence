const mongoose = require('mongoose');

const STAFFING_REQUEST_STATUSES = ['open', 'closed'];
const STAFFING_REQUEST_CLOSE_REASONS = ['fulfilled', 'declined', 'cancelled'];

const draftProjectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    client: {
      type: String,
      trim: true,
      maxlength: 160,
      default: '',
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },
  },
  { _id: false }
);

const requestedPositionSchema = new mongoose.Schema(
  {
    position: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Position',
      required: true,
    },
    count: {
      type: Number,
      required: true,
      min: 1,
    },
    technologies: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Technology',
      },
    ],
  },
  { _id: false }
);

const staffingRequestSchema = new mongoose.Schema(
  {
    // At least one of these two is set — enforced below. `draftProject` is
    // never overwritten once `project` is resolved (see ticket 06); both then
    // coexist so the original ask stays visible after resolution.
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
    },
    draftProject: {
      type: draftProjectSchema,
    },
    requestedPositions: {
      type: [requestedPositionSchema],
      default: [],
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // The admin's remark on the request, written when picking candidates for
    // it — anything leadership should know that the suggestions themselves
    // don't say. One note per request, admin-authored, overwritten on re-save:
    // this is a mention, not a conversation. Never written by the author who
    // filed the request. Declining requires it (enforced below); a
    // cancellation reason goes to `closeNote` so it can never overwrite this.
    note: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: '',
    },
    noteBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    noteAt: {
      type: Date,
    },
    // Why the request was cancelled — optional, author- or admin-supplied.
    closeNote: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: '',
    },
    neededBy: {
      type: Date,
    },
    status: {
      type: String,
      enum: STAFFING_REQUEST_STATUSES,
      default: 'open',
      index: true,
    },
    reason: {
      type: String,
      enum: STAFFING_REQUEST_CLOSE_REASONS,
    },
    closedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    closedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

staffingRequestSchema.path('requestedPositions').validate(function validateNoDuplicatePositions(
  positions
) {
  const seen = new Set();
  for (const requestedPosition of positions || []) {
    const key = String(requestedPosition.position);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
  }
  return true;
}, 'A position may appear at most once per request');

// Throw rather than call a `next` callback — Mongoose 9 dropped callback-style
// middleware, and a `function (next)` hook here fails with "next is not a
// function" on every save (see the identical note in ReadinessFlag.js).
staffingRequestSchema.pre('validate', function enforceProjectIdentity() {
  const hasProject = Boolean(this.project);
  const hasDraftProject = Boolean(this.draftProject);
  if (!hasProject && !hasDraftProject) {
    throw new Error('At least one of project or draftProject must be set on a staffing request');
  }
});

// The note is a triple — text, who wrote it, when. Any one alone leaves the
// UI rendering an unattributed or undated remark.
staffingRequestSchema.pre('validate', function enforceNoteFields() {
  const parts = [Boolean(this.note?.trim()), Boolean(this.noteBy), Boolean(this.noteAt)];
  if (parts.some(Boolean) && !parts.every(Boolean)) {
    throw new Error('A note must carry its text, who wrote it, and when');
  }
});

staffingRequestSchema.pre('validate', function enforceCloseFields() {
  if (this.status === 'closed') {
    if (!this.reason) {
      throw new Error('A closed staffing request must carry a reason');
    }
    if (!this.closedBy) {
      throw new Error('A closed staffing request must carry who closed it');
    }
    if (!this.closedAt) {
      throw new Error('A closed staffing request must carry when it was closed');
    }
    if (this.reason === 'declined' && !this.note?.trim()) {
      throw new Error('Declining a staffing request requires a non-empty note');
    }
  }
});

module.exports = mongoose.model('StaffingRequest', staffingRequestSchema);
module.exports.STAFFING_REQUEST_STATUSES = STAFFING_REQUEST_STATUSES;
module.exports.STAFFING_REQUEST_CLOSE_REASONS = STAFFING_REQUEST_CLOSE_REASONS;
