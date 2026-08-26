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
    // `null` is the stored meaning of "we don't know the project yet" — never
    // a separate flag, and never a sentinel document. See
    // `.claude/docs/architecture.md`.
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
      index: true,
    },
    // Set when this recommendation was created by fulfilling a staffing
    // request; null for recommendations created the ordinary way. A requested
    // position is identified by staffingRequest + position — there is no
    // separate line id on the request itself.
    staffingRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StaffingRequest',
      default: null,
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
      // This `not_placed` was caused by the demand ending, not by a decision
      // about the intern: their staffing request was closed, or the position
      // they were offered for was changed or removed. Set ONLY by the
      // close-out cascade in recommendationService — `applyResultPayload`
      // ignores it on the way in, because an admin who could set it by hand
      // could tell a genuinely rejected intern their opportunity was withdrawn.
      //
      // It is the one part of `result` besides the outcome that reaches the
      // intern (`formatOwnRecommendation`), where it swaps the "not placed"
      // copy for "this closed before a decision was made about you". The note
      // itself stays internal, so without this flag the two cases are
      // indistinguishable on the intern's dashboard. Any future
      // placed-vs-not-placed metric must exclude these (ADR 0004).
      demandEnded: {
        type: Boolean,
        default: false,
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
