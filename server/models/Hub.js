const mongoose = require('mongoose');

// Company office / location (e.g. Sarajevo, Belgrade, Novi Sad, Skopje).
// Admin-managed reference data shared across the whole platform.
const hubSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    city: {
      type: String,
      trim: true,
      maxlength: 100,
      default: '',
    },
    country: {
      type: String,
      trim: true,
      maxlength: 100,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

hubSchema.index({ name: 1 }, { unique: true });

module.exports = mongoose.model('Hub', hubSchema);
