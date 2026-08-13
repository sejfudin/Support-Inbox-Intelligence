const mongoose = require('mongoose');

// Entity types the history log can attach to. `ticket` is the original use;
// `recommendation` was added to track append-only recommendation status changes;
// `staffingRequest` tracks staffing-request events, which double as the
// source of the leadership/admin news badge (see historyService).
const HISTORY_ENTITY_TYPES = ['ticket', 'recommendation', 'staffingRequest'];

const historySchema = new mongoose.Schema({
  // Legacy ticket reference. Kept (and still populated) for backward
  // compatibility with all existing ticket history queries/call sites. New
  // code should read/write via entityType + entityId below; for tickets both
  // are set so old and new queries agree.
  ticketId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ticket',
    required: false,
    index: true,
  },
  // Polymorphic target: which kind of entity this event belongs to and its id.
  entityType: {
    type: String,
    enum: HISTORY_ENTITY_TYPES,
    default: 'ticket',
    index: true,
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
    index: true,
  },
  action: {
    type: String,
    required: true,
    trim: true,
  },
  // Optional machine-readable status key for status-change events (e.g.
  // 'recommended' | 'interviewing' | 'placed'). Lets consumers read the latest
  // date per status without parsing the human-readable `action` string.
  // Staffing-request keys are namespaced ('staffing:filed', ...) because this
  // string space is shared across entity types and 'placed' is already taken.
  statusKey: {
    type: String,
    trim: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
  },
  userName: {
    type: String,
    required: true,
    trim: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

// Fast lookup of an entity's log, newest first.
historySchema.index({ entityType: 1, entityId: 1, timestamp: -1 });

// Supports the staffing-request news badge: "which entities of this type have
// an event newer than timestamp X", scanning across entities rather than one.
historySchema.index({ entityType: 1, timestamp: -1 });

const History = mongoose.model('History', historySchema);

module.exports = History;
module.exports.HISTORY_ENTITY_TYPES = HISTORY_ENTITY_TYPES;
