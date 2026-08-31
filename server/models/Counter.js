/**
 * A named, monotonically increasing sequence, scoped to one workspace.
 *
 * The only sequence today is `'ticket'`, which hands out `Ticket.taskNumber`.
 * It exists because `taskNumber` used to be computed as `max + 1` by a read
 * followed by a write, and concurrent creates all read the same maximum. A
 * single `findOneAndUpdate` + `$inc` against one document is atomic, so each
 * request observes the committed result of the one before it.
 *
 * `name` is not fixed to `'ticket'` so a second per-workspace sequence can be
 * added without a second collection.
 */
const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    seq: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Unique is what makes the counter a counter: exactly one document per
// (workspace, sequence), so every `$inc` lands on the same row. Safe to declare
// here — the collection is new, so there is nothing to repair.
counterSchema.index({ workspace: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Counter', counterSchema);
