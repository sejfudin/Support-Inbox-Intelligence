const mongoose = require('mongoose');

const INTERN_STATUSES = ['active', 'ready', 'placed', 'completed', 'discontinued'];

const documentationLinkSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    url: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
  },
  { timestamps: true }
);

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
    readyForPlacement: {
      type: Boolean,
      default: false,
    },
    expectedEndDate: {
      type: Date,
    },
    selfTechnologies: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Technology',
      },
    ],
    declaredPosition: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Position',
      default: null,
    },
    cvPath: {
      type: String,
      default: null,
    },
    documentationLinks: {
      type: [documentationLinkSchema],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('InternProfile', internProfileSchema);
module.exports.INTERN_STATUSES = INTERN_STATUSES;
