const mongoose = require('mongoose');

const technologySchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    // Which of the two catalogs a row belongs to. AI skills (`ai`) are technologies in
    // every other respect — declared, assessed and staffed exactly the same way — the
    // category only decides which search box finds them and which section lists them.
    // Rows seeded before this field exists carry no value at all, so read it as
    // "anything that is not 'ai' is general" rather than trusting the default.
    category: {
      type: String,
      enum: ['general', 'ai'],
      default: 'general',
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Technology', technologySchema);
