const mongoose = require('mongoose');

const PROJECT_STATUSES = ['active', 'on_hold', 'completed'];

// Starting pair only — the full type list is still being settled with the
// program leads. Values are stored slugs; display labels live in the frontend
// (frontend/src/helpers/projects.js), so relabelling never needs a migration.
const PROJECT_TYPES = ['client', 'internal'];

const projectSchema = new mongoose.Schema(
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
      maxlength: 160,
    },
    client: {
      type: String,
      trim: true,
      maxlength: 160,
      default: '',
    },
    // Required with no default on purpose: the admin must classify every
    // project explicitly. Pre-existing docs are backfilled to 'client' by
    // seeder/backfillProjectTypes.js — run it before anyone edits a project,
    // since an unset type now fails validation on save.
    type: {
      type: String,
      enum: PROJECT_TYPES,
      required: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },
    technologies: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Technology',
      },
    ],
    status: {
      type: String,
      enum: PROJECT_STATUSES,
      default: 'active',
      index: true,
    },
    isSystem: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Project', projectSchema);
module.exports.PROJECT_STATUSES = PROJECT_STATUSES;
module.exports.PROJECT_TYPES = PROJECT_TYPES;
