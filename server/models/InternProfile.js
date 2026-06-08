const mongoose = require('mongoose');

const INTERN_STATUSES = ['active', 'ready', 'placed', 'completed', 'discontinued'];

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
  },
  { timestamps: true }
);

module.exports = mongoose.model('InternProfile', internProfileSchema);
module.exports.INTERN_STATUSES = INTERN_STATUSES;
