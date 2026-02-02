const mongoose = require('mongoose');

const aiLogSchema = new mongoose.Schema({
  ticketId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ticket',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['success', 'fail'],
    required: true
  },
  latencyMs: {
    type: Number,
    required: true,
    min: 0
  },
  errorMessage: {
    type: String,
    default: ""
  }
}, {
  timestamps: true 
});

aiLogSchema.index({ status: 1, createdAt: -1 });
aiLogSchema.index({ ticketId: 1 });

module.exports = mongoose.model('AILog', aiLogSchema);