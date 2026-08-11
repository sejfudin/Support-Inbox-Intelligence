const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    type: {
      type: String,
      enum: [
        // Ticketing domain
        'ticket_comment',
        'ticket_assigned',
        'ticket_mention',
        // Intern-programme domain — admin/mentor changes surfaced to the intern
        'recommendation_created',
        'recommendation_status_changed',
        'recommendation_not_placed',
        'intern_placed',
        'evaluation_created',
        'readiness_updated',
        'specialization_assigned',
        'specialization_reassigned',
        'specialization_mentor_changed',
        'specialization_cleared',
        'intern_status_changed',
        'intern_expected_end_date_changed',
        'intern_documentation_updated',
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    body: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    // Ticketing domain only — absent on intern-programme notifications.
    ticket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ticket',
      default: null,
      index: true,
    },
    comment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment',
      default: null,
      index: true,
    },
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      default: null,
    },
    // Intern-programme domain only — absent on ticketing notifications.
    internProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InternProfile',
      default: null,
      index: true,
    },
    // Optional frontend route the notification's action button navigates to.
    // Ticket types keep navigating via `ticket`/`comment` instead (see
    // NotificationRow); this is for domains with no ticket to deep-link to.
    link: {
      type: String,
      trim: true,
      maxlength: 300,
      default: '',
    },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, read: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
