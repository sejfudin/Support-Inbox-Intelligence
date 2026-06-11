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
      required: true,
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

readinessFlagSchema.index({ internProfile: 1, technology: 1 }, { unique: true });

module.exports = mongoose.model('ReadinessFlag', readinessFlagSchema);
module.exports.READINESS_LEVELS = READINESS_LEVELS;
