const mongoose = require('mongoose');

// The one stored aggregate in the schema, and the single exception to "no
// cached counts": a past sprint's final numbers, written once the first time the
// sprint is read after its end date and never rewritten. See ADR 0012 — without
// it, carrying a leftover out of a finished sprint rewrites that sprint's
// history, because membership is a single reference on the ticket.
//
// The three metric blocks are `Mixed` on purpose. Their shape is owned by
// `helpers/sprintRules.js`'s `sprintMetrics`, which is also what writes them —
// restating it here would give the schema a second opinion about what a sprint's
// numbers are, which is exactly what ADR 0012 forbids.
const sprintSnapshotSchema = new mongoose.Schema(
  {
    sealedAt: { type: Date, required: true },
    progress: { type: mongoose.Schema.Types.Mixed, required: true },
    workingDays: { type: mongoose.Schema.Types.Mixed, required: true },
    needsAttention: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { _id: false }
);

// Stores only the workspace, name, dates, optional goal and — once the sprint is
// past — its sealed numbers. No state field, no ticket list, no live counts.
// State is derived (see helpers/sprintRules) and membership lives on the ticket.
// See ADR 0010, and ADR 0012 for the snapshot.
const sprintSchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'A sprint needs a name'],
      trim: true,
    },
    start: {
      type: Date,
      required: [true, 'A sprint needs a start date'],
    },
    end: {
      type: Date,
      required: [true, 'A sprint needs an end date'],
    },
    goal: {
      type: String,
      trim: true,
      default: '',
    },
    // Null until the sprint is sealed. Write-once: the seal is applied with a
    // `snapshot: null` filter so a concurrent second read cannot overwrite it.
    snapshot: {
      type: sprintSnapshotSchema,
      default: null,
    },
    // The sprint this one succeeds, when it was created by the rollover rather
    // than by a person. Null for every hand-made sprint. See ADR 0014.
    //
    // It is the audit trail — "nobody planned this" is worth knowing on the Past
    // tab — but its load-bearing job is the unique index below.
    rolledOverFrom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sprint',
      default: null,
    },
  },
  { timestamps: true }
);

// Backs both the sprint board and the "which sprints exist in this workspace"
// overlap/listing queries.
sprintSchema.index({ workspace: 1, start: 1 });

// Backs the "what does a new sprint have to start after" read, which sorts by
// end rather than by start — a long sprint can end after one that starts later.
sprintSchema.index({ workspace: 1, end: -1 });

// A sprint may be rolled over from ONCE, and the database is what guarantees it.
//
// This is the whole concurrency story for ADR 0014. Rollover happens on read, so
// two simultaneous first-reads-after-a-sprint-ends both decide to create the
// successor; one insert lands and the other takes a duplicate-key error and
// simply re-reads. A process-level lock could not promise this across workers,
// and an in-memory guard (as `dailyReminderService` uses for reminders) is
// explicitly scoped there to work that cannot corrupt data — a duplicate sprint
// with tickets moved into it can.
//
// Partial on `$type: 'objectId'` rather than `$exists: true`, because every
// hand-made sprint stores an explicit null and `$exists` would match all of them
// — making the second manually created sprint in a workspace unsaveable.
sprintSchema.index(
  { workspace: 1, rolledOverFrom: 1 },
  {
    unique: true,
    partialFilterExpression: { rolledOverFrom: { $type: 'objectId' } },
  }
);

module.exports = mongoose.model('Sprint', sprintSchema);
