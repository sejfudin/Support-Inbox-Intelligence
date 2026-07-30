const History = require('../models/History');
const User = require('../models/User');

// ---- Ticket helpers (kept for backward compatibility) --------------------
// Existing ticket call sites pass a ticketId. We keep populating ticketId AND
// mirror it into the polymorphic entityType/entityId so both old ticket
// queries and the generalized entity queries return the same records.

const logEvent = async (ticketId, userId, action) => {
  try {
    const user = await User.findById(userId).select('fullname').lean();
    const userName = user?.fullname || 'Unknown User';

    await History.create({
      ticketId,
      entityType: 'ticket',
      entityId: ticketId,
      userId,
      userName,
      action,
    });
  } catch (err) {
    console.error('[historyService] Failed to log event:', err.message);
  }
};

const logSystemEvent = async (ticketId, action, actorLabel = 'GitHub Automation') => {
  try {
    await History.create({
      ticketId,
      entityType: 'ticket',
      entityId: ticketId,
      userId: null,
      userName: actorLabel,
      action,
    });
  } catch (err) {
    console.error('[historyService] Failed to log system event:', err.message);
  }
};

// ---- Generalized entity helpers -----------------------------------------

/**
 * Append an event to any entity's history log. Append-only — never updates an
 * existing record, so the full trail of changes is preserved.
 *
 * @param {Object} opts
 * @param {string} opts.entityType  one of HISTORY_ENTITY_TYPES
 * @param {ObjectId} opts.entityId
 * @param {ObjectId|null} opts.userId  actor (null for system events)
 * @param {string} opts.action        human-readable description
 * @param {string} [opts.statusKey]   machine-readable status for status changes
 * @param {string} [opts.userName]    override actor label (else resolved from userId)
 */
const logEntityEvent = async ({ entityType, entityId, userId, action, statusKey, userName }) => {
  try {
    let resolvedName = userName;
    if (!resolvedName) {
      if (userId) {
        const user = await User.findById(userId).select('fullname').lean();
        resolvedName = user?.fullname || 'Unknown User';
      } else {
        resolvedName = 'System';
      }
    }

    await History.create({
      entityType,
      entityId,
      // Keep ticketId populated for ticket entities so legacy queries still work.
      ticketId: entityType === 'ticket' ? entityId : undefined,
      userId: userId || null,
      userName: resolvedName,
      action,
      statusKey,
    });
  } catch (err) {
    console.error('[historyService] Failed to log entity event:', err.message);
  }
};

/**
 * Remove an entity's entire log — for when the entity itself is deleted and
 * its trail has no other consumer (e.g. deleting a recommendation).
 */
const deleteEntityHistory = async (entityType, entityId) =>
  History.deleteMany({ entityType, entityId });

/**
 * Latest timestamp per statusKey for one entity — the source of the "date this
 * status was applied" columns/labels. Returns { [statusKey]: Date }.
 * Because the log is append-only and we take the max timestamp, re-entering a
 * status (status went backward then forward again) correctly reflects the most
 * recent time it was applied without ever losing earlier entries.
 */
const getLatestStatusDates = async (entityType, entityId) => {
  const rows = await History.aggregate([
    { $match: { entityType, entityId, statusKey: { $ne: null } } },
    { $group: { _id: '$statusKey', latest: { $max: '$timestamp' } } },
  ]);
  return rows.reduce((acc, row) => {
    if (row._id) acc[row._id] = row.latest;
    return acc;
  }, {});
};

/**
 * Latest timestamp per statusKey for MANY entities at once (used by the
 * recommendations table so it isn't N+1). Returns
 * { [entityId]: { [statusKey]: Date } }.
 */
const getLatestStatusDatesForEntities = async (entityType, entityIds = []) => {
  if (!entityIds || entityIds.length === 0) return {};
  const rows = await History.aggregate([
    { $match: { entityType, entityId: { $in: entityIds }, statusKey: { $ne: null } } },
    {
      $group: {
        _id: { entityId: '$entityId', statusKey: '$statusKey' },
        latest: { $max: '$timestamp' },
      },
    },
  ]);
  return rows.reduce((acc, row) => {
    const id = row._id.entityId.toString();
    if (!acc[id]) acc[id] = {};
    if (row._id.statusKey) acc[id][row._id.statusKey] = row.latest;
    return acc;
  }, {});
};

module.exports = {
  logEvent,
  logSystemEvent,
  logEntityEvent,
  deleteEntityHistory,
  getLatestStatusDates,
  getLatestStatusDatesForEntities,
};
