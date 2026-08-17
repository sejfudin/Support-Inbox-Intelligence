const mongoose = require('mongoose');

// `ready` marks an intern as ready for placement — the bench, urgency list, and
// leadership KPIs are all derived from it.
const READY_STATUS = 'ready';
const INTERN_STATUSES = ['active', READY_STATUS, 'placed', 'completed', 'discontinued'];

// The statuses that mean "still in the programme" — an intern who is placed,
// completed or discontinued has no live attendance or workload to report. Shared
// so the attendance roster and the admin dashboard can't drift apart on who they
// count; both used to carry their own copy of this list.
const IN_PROGRAMME_STATUSES = ['active', READY_STATUS];

const documentationLinkSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    url: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
  },
  { timestamps: true }
);

const internProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    internshipType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InternshipType',
      required: true,
    },
    primaryMentor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    secondaryMentor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    startDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: INTERN_STATUSES,
      default: 'active',
    },
    expectedEndDate: {
      type: Date,
    },
    // The intern's FIRST DAY ON A REAL PROJECT. From this day on they are no longer
    // obliged to record FEP attendance: those days leave the attendance denominator
    // and render in their own colour in the calendar — not as absences, and not as
    // a weekend's grey either. Null while the intern is still on the programme.
    //
    // Inclusive-from: `placedAt` itself is already exempt, so the last day the
    // intern owed attendance is the day before it.
    //
    // Mirrors the start date on the placement that put them there — the day they
    // actually begin, not the day the placement was decided — and is re-derived
    // from it whenever that recommendation is updated, so editing the start date
    // moves this with it. A placement recorded before anyone knows the start date
    // leaves this null: still placed on paper, still owes attendance. Interns
    // with no recommendation record at all are exempted by setting it by hand
    // (internService). See recommendationService and helpers/attendanceStats.js.
    //
    // Distinct from `expectedEndDate`, which is when the internship is *expected*
    // to finish and drives placement-bench urgency. Do not conflate them.
    placedAt: {
      type: Date,
      default: null,
    },
    selfTechnologies: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Technology',
      },
    ],
    // Provenance for the CV scan: the subset of `selfTechnologies` that the most recent CV
    // upload added, so re-uploading a CV can replace those instead of piling on top of them.
    // Always a subset of `selfTechnologies`; never exposed to clients. Anything the intern
    // declared by hand stays out of here — see helpers/cvTechnologySync.js.
    cvTechnologies: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Technology',
      },
    ],
    declaredPosition: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Position',
      default: null,
    },
    secondaryPosition: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Position',
      default: null,
    },
    specializationAssignedAt: {
      type: Date,
      default: null,
    },
    cvPath: {
      type: String,
      default: null,
    },
    // The AI read of the intern's own uploaded CV, shown to admins and mentors on
    // the profile overview. Cached rather than generated per view: it costs a PDF
    // download, a text extraction and a model call, and the input only changes when
    // the intern re-uploads.
    //
    // `cvSummaryFor` is the `cvPath` the summary was generated from, and is what
    // makes the cache honest — a re-upload writes a new path, so the stored summary
    // is recognised as describing a CV that is no longer there rather than being
    // served against the new one. Clearing it is how any code path invalidates the
    // summary without having to blank the text itself.
    cvSummary: {
      type: String,
      default: null,
      maxlength: 4000,
    },
    cvSummaryFor: {
      type: String,
      default: null,
    },
    cvSummaryAt: {
      type: Date,
      default: null,
    },
    // Mentor/admin-added CV link (e.g. Google Drive). Separate from the intern's
    // own uploaded CV (cvPath) and never exposed to the intern.
    internalCvUrl: {
      type: String,
      default: null,
      trim: true,
      maxlength: 2000,
    },
    documentationLinks: {
      type: [documentationLinkSchema],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('InternProfile', internProfileSchema);
module.exports.INTERN_STATUSES = INTERN_STATUSES;
module.exports.READY_STATUS = READY_STATUS;
module.exports.IN_PROGRAMME_STATUSES = IN_PROGRAMME_STATUSES;
