const mongoose = require('mongoose');

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
