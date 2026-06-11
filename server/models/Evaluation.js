const mongoose = require('mongoose');

const evaluationSchema = new mongoose.Schema(
  {
    internProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InternProfile',
      required: true,
      index: true,
    },
    evaluator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    periodStart: {
      type: Date,
      required: true,
    },
    periodEnd: {
      type: Date,
      required: true,
    },
    scores: {
      technical: { type: Number, min: 1, max: 5, required: true },
      communication: { type: Number, min: 1, max: 5, required: true },
      ownership: { type: Number, min: 1, max: 5, required: true },
      growth: { type: Number, min: 1, max: 5, required: true },
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 3000,
      default: '',
    },
  },
  { timestamps: true }
);

evaluationSchema.index({ internProfile: 1, periodEnd: -1 });

module.exports = mongoose.model('Evaluation', evaluationSchema);
