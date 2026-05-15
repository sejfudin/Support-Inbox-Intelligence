const mongoose = require('mongoose');

const taskStatusSchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    color: {
      type: String,
      default: '#6366f1',
    },
    sortOrder: {
      type: Number,
      required: true,
      default: 0,
    },
    isBacklog: {
      type: Boolean,
      default: false,
    },
    tracksTime: {
      type: Boolean,
      default: false,
    },
    isDone: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

taskStatusSchema.index({ workspace: 1, slug: 1 }, { unique: true });
taskStatusSchema.index({ workspace: 1, sortOrder: 1 });

module.exports = mongoose.model('TaskStatus', taskStatusSchema);
