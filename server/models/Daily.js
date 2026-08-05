const mongoose = require('mongoose');
const { startOfDay } = require('../helpers/dailyRules');

// A blocker is a line of free text with one optional link to a workspace
// ticket. Text is stored verbatim (plain text, like comments) — never
// HTML-sanitized.
const blockerSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: [true, 'Blocker text is required'],
    },
    linkedTicket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ticket',
      default: null,
    },
  },
  { _id: false }
);

// A cached AI summary of one entry, for the intern dashboard's standup card
// (long notes are shown summarised, expandable to the full text).
//
// Lives on the entry rather than in its own collection: it is derived from
// exactly this text, it is only ever read alongside it, and it is deleted with
// it. `sourceHash` is a digest of the done/todo/blocker lines the summary was
// generated from — the moment the intern edits any of them the hash stops
// matching and the summary is treated as absent rather than shown stale. Never
// display this without checking the hash.
const entryAiSummarySchema = new mongoose.Schema(
  {
    text: { type: String, default: '' },
    sourceHash: { type: String, default: '' },
    generatedAt: { type: Date },
  },
  { _id: false }
);

// One intern's slot within a Daily. Having an entry means the intern was
// present — there is deliberately no `present` field.
const dailyEntrySchema = new mongoose.Schema(
  {
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'An entry must belong to a member'],
    },
    done: {
      type: [String],
      default: [],
    },
    todo: {
      type: [String],
      default: [],
    },
    blockers: {
      type: [blockerSchema],
      default: [],
    },
    aiSummary: {
      type: entryAiSummarySchema,
      default: null,
    },
  },
  { timestamps: true }
);

const dailySchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    // The calendar date of the standup, normalized to start-of-day (see the
    // pre-validate hook). "Today" and the edit window use server-side dates.
    date: {
      type: Date,
      required: true,
    },
    // Creator / last editor — attribution only, not a granted power. Rotates
    // naturally day to day.
    scribe: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    entries: {
      type: [dailyEntrySchema],
      default: [],
    },
  },
  { timestamps: true }
);

// Normalize the date to start-of-day so the unique (workspace, date) index
// treats an entire calendar date as one slot regardless of the time-of-day
// component that reaches the model.
dailySchema.pre('validate', function normalizeDate() {
  if (this.date instanceof Date && !Number.isNaN(this.date.getTime())) {
    this.date = startOfDay(this.date);
  }
});

// One Daily per workspace per calendar date.
dailySchema.index({ workspace: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Daily', dailySchema);
