const mongoose = require('mongoose');

const READINESS_LEVELS = ['none', 'learning', 'ready'];

const readinessFlagSchema = new mongoose.Schema(
  {
    internProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InternProfile',
      required: true,
    },
    technology: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Technology',
      default: null,
    },
    position: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Position',
      default: null,
    },
    level: {
      type: String,
      enum: READINESS_LEVELS,
      default: 'none',
    },
    setBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// Exactly one target: a technology flag or a position flag, never both/neither.
// Throw rather than call a `next` callback — Mongoose 9 dropped callback-style
// middleware, and a `function (next)` hook here fails with "next is not a
// function" on every save. Note this is document middleware, so it does NOT run
// for the service's findOneAndUpdate upsert; readinessFlagService checks the
// same invariant itself before querying.
readinessFlagSchema.pre('validate', function assertSingleTarget() {
  if (!this.technology && !this.position) {
    throw new Error('A readiness flag requires a technology or a position');
  }
  if (this.technology && this.position) {
    throw new Error('A readiness flag cannot target both a technology and a position');
  }
});

// Position flags carry technology: null, so this index also caps role flags at
// one per intern — the flag is rewritten when the declared position changes.
readinessFlagSchema.index({ internProfile: 1, technology: 1 }, { unique: true });

module.exports = mongoose.model('ReadinessFlag', readinessFlagSchema);
module.exports.READINESS_LEVELS = READINESS_LEVELS;
