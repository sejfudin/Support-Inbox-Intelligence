const mongoose = require('mongoose');

// Stores only the workspace, name, dates and optional goal — no state field,
// no ticket list, no cached counts. State is derived (see helpers/sprintRules)
// and membership lives on the ticket. See ADR 0010.
const sprintSchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'A sprint needs a name'],
      trim: true,
    },
    start: {
      type: Date,
      required: [true, 'A sprint needs a start date'],
    },
    end: {
      type: Date,
      required: [true, 'A sprint needs an end date'],
    },
    goal: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { timestamps: true }
);

// Backs both the sprint board and the "which sprints exist in this workspace"
// overlap/listing queries.
sprintSchema.index({ workspace: 1, start: 1 });

module.exports = mongoose.model('Sprint', sprintSchema);
