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
    // Exactly one of these two is set — enforced below. `draftProject` is never
    // overwritten once `project` is resolved; both coexist so the original ask
    // stays visible after resolution (see ticket 05).
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
    note: {
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

staffingRequestSchema.pre('validate', function enforceExclusiveProjectIdentity(next) {
  const hasProject = Boolean(this.project);
  const hasDraftProject = Boolean(this.draftProject);
  if (hasProject === hasDraftProject) {
    next(new Error('Exactly one of project or draftProject must be set on a staffing request'));
    return;
  }
  next();
});

staffingRequestSchema.pre('validate', function enforceCloseFields(next) {
  if (this.status === 'closed') {
    if (!this.reason) {
      next(new Error('A closed staffing request must carry a reason'));
      return;
    }
    if (!this.closedBy) {
      next(new Error('A closed staffing request must carry who closed it'));
      return;
    }
    if (!this.closedAt) {
      next(new Error('A closed staffing request must carry when it was closed'));
      return;
    }
    if (this.reason === 'declined' && !this.note?.trim()) {
      next(new Error('Declining a staffing request requires a non-empty note'));
      return;
    }
  }
  next();
});

module.exports = mongoose.model('StaffingRequest', staffingRequestSchema);
module.exports.STAFFING_REQUEST_STATUSES = STAFFING_REQUEST_STATUSES;
module.exports.STAFFING_REQUEST_CLOSE_REASONS = STAFFING_REQUEST_CLOSE_REASONS;
