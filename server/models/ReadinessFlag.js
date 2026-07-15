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

readinessFlagSchema.pre('validate', function (next) {
  if (!this.technology && !this.position) {
    return next(new Error('A readiness flag requires a technology or a position'));
  }
  if (this.technology && this.position) {
    return next(new Error('A readiness flag cannot target both a technology and a position'));
  }
  next();
});

// Position flags carry technology: null, so this index also caps role flags at
// one per intern — the flag is rewritten when the declared position changes.
readinessFlagSchema.index({ internProfile: 1, technology: 1 }, { unique: true });

module.exports = mongoose.model('ReadinessFlag', readinessFlagSchema);
module.exports.READINESS_LEVELS = READINESS_LEVELS;
