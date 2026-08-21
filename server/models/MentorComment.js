const mongoose = require('mongoose');

const mentorCommentSchema = new mongoose.Schema(
  {
    internProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InternProfile',
      required: true,
      index: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    visibleTo: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    // A deliberate, separate axis from `visibleTo`: that array is staff sharing a
    // note with staff peers, this is the author choosing — at write time, per note
    // — to let the intern it's about read this one too. Keeping it a distinct
    // field (rather than allowing the intern's own id inside `visibleTo`) means a
    // bug or a future "share with everyone" shortcut on the staff picker can never
    // accidentally expose a note to its subject. Defaults false: every note ever
    // written before this field existed was authored under the expectation of
    // staying internal, and must stay that way.
    visibleToIntern: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

mentorCommentSchema.index({ internProfile: 1, createdAt: -1 });

module.exports = mongoose.model('MentorComment', mentorCommentSchema);
