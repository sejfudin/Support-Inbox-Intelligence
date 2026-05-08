const mongoose = require('mongoose');

const aiSummarySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    summary: { type: String, default: '' },
    generatedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

aiSummarySchema.index({ user: 1, workspace: 1, generatedAt: -1 });

module.exports = mongoose.model('AISummary', aiSummarySchema);
