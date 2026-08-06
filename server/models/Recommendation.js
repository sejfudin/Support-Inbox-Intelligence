const mongoose = require('mongoose');

const RECOMMENDATION_STATUSES = ['recommended', 'interviewing', 'resulted'];
const RECOMMENDATION_RESULTS = ['placed', 'not_placed'];

const feedbackSchema = new mongoose.Schema(
  {
    summary: {
      type: String,
      trim: true,
      maxlength: 3000,
      default: '',
    },
    strengths: {
      type: String,
      trim: true,
      maxlength: 3000,
      default: '',
    },
    concerns: {
      type: String,
      trim: true,
      maxlength: 3000,
      default: '',
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
  },
  { _id: false }
);

const interviewSchema = new mongoose.Schema(
  {
    company: {
      type: String,
      trim: true,
      maxlength: 160,
      required: true,
    },
    role: {
      type: String,
      trim: true,
      maxlength: 160,
      required: true,
    },
    stage: {
      type: String,
      trim: true,
      maxlength: 120,
      default: '',
    },
    scheduledAt: {
      type: Date,
    },
    interviewers: [
      {
        type: String,
        trim: true,
        maxlength: 120,
      },
    ],
    locationNote: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
    feedback: {
      type: feedbackSchema,
      default: () => ({}),
    },
  },
  { timestamps: true }
);

const recommendationSchema = new mongoose.Schema(
  {
    internProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InternProfile',
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    position: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Position',
      required: true,
      index: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    technologies: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Technology',
      },
    ],
    status: {
      type: String,
      enum: RECOMMENDATION_STATUSES,
      default: 'recommended',
      index: true,
    },
    // Authoritative date each stage was reached, editable by the author (the
    // append-only History log stays as the audit trail and as a fallback for
    // records created before this field existed). A reached-but-dateless
    // interviewing stage on a resulted recommendation means it was skipped.
    statusDates: {
      recommended: { type: Date },
      interviewing: { type: Date },
      resulted: { type: Date },
    },
    recommendationNote: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: '',
    },
    interviews: [interviewSchema],
    result: {
      outcome: {
        type: String,
        enum: RECOMMENDATION_RESULTS,
      },
      note: {
        type: String,
        trim: true,
        maxlength: 5000,
        default: '',
      },
      decidedAt: {
        type: Date,
      },
      decidedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      // The intern's FIRST DAY ON THE PROJECT — when the placement actually
      // begins, which is routinely not the day it was decided. Deliberately
      // optional: a placement is often recorded before anyone knows the start
      // date, and an empty field is how "we don't know yet" stays visible
      // instead of being papered over with a guess. Editable afterwards,
      // forwards or backwards, as many times as the date slips.
      //
      // Drives the intern's attendance exemption through
      // `InternProfile.placedAt` — while this is empty they are still on the
      // programme and still owe attendance. See `placementExemptionDate` in
      // helpers/attendanceStats.js and the sync in recommendationService.
      //
      // Only meaningful alongside `outcome: 'placed'`; reversing an outcome
      // clears it.
      startDate: {
        type: Date,
      },
    },
  },
  { timestamps: true }
);

recommendationSchema.index({ internProfile: 1, updatedAt: -1 });
recommendationSchema.index({ technologies: 1 });
recommendationSchema.index({ 'result.outcome': 1 });

recommendationSchema.path('result.note').validate(function validateResultNote(note) {
  return !this.result?.outcome || Boolean(note?.trim());
}, 'Result note is required');

module.exports = mongoose.model('Recommendation', recommendationSchema);
module.exports.RECOMMENDATION_STATUSES = RECOMMENDATION_STATUSES;
module.exports.RECOMMENDATION_RESULTS = RECOMMENDATION_RESULTS;
