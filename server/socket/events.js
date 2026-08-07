const {
  broadcastToTicket,
  broadcastToWorkspaceTicketAndUsers,
  broadcastToWorkspace,
  broadcastToAll,
} = require('./socketServer');
const { invalidationScopes } = require('./invalidationScopes');
const User = require('../models/User');
const Workspace = require('../models/Workspace');
const { ROLES } = require('../constants/roles');

const toSocketId = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);

  if (typeof value === 'object') {
    if (typeof value.toHexString === 'function') return value.toHexString();
    if (value._id) return toSocketId(value._id);
    if (value.id) return String(value.id);
  }

  if (typeof value.toString === 'function') return value.toString();
  return null;
};

const buildTicketScopes = ({ ticketId, workspaceId }) => {
  const scopes = [];

  if (workspaceId) {
    scopes.push(invalidationScopes.workspaceTickets(workspaceId));
  }

  if (ticketId) {
    scopes.push(invalidationScopes.ticket(ticketId));
  }

  return scopes;
};

const getWorkspaceAudienceUserIds = async (workspaceId) => {
  try {
    // Admins are notified across every workspace. Everyone else is reached
    // through the workspace's owner and active members below — never through
    // `User.workspaceId`, which is a pointer to the workspace a user last
    // switched to and outlives the membership that made it valid.
    const [workspace, admins] = await Promise.all([
      Workspace.findById(workspaceId).select('owner members.user members.status').lean(),
      User.find({
        active: true,
        status: 'active',
        role: ROLES.ADMIN,
      })
        .select('_id')
        .lean(),
    ]);

    const userIds = new Set(admins.map((admin) => toSocketId(admin._id)).filter(Boolean));

    if (workspace?.owner) {
      userIds.add(toSocketId(workspace.owner));
    }

    (workspace?.members || []).forEach((member) => {
      if (member?.status === 'active' && member.user) {
        userIds.add(toSocketId(member.user));
      }
    });

    return [...userIds];
  } catch (error) {
    return [];
  }
};

const emitTicketEvent = async ({ eventName, ticketId, workspaceId, extra = {}, options = {} }) => {
  const resolvedTicketId = toSocketId(ticketId);
  const resolvedWorkspaceId = toSocketId(workspaceId);

  if (!resolvedTicketId || !resolvedWorkspaceId) return false;

  const audienceUserIds = await getWorkspaceAudienceUserIds(resolvedWorkspaceId);

  return broadcastToWorkspaceTicketAndUsers(
    resolvedWorkspaceId,
    resolvedTicketId,
    audienceUserIds,
    eventName,
    {
      ticketId: resolvedTicketId,
      workspaceId: resolvedWorkspaceId,
      scopes: buildTicketScopes({
        ticketId: resolvedTicketId,
        workspaceId: resolvedWorkspaceId,
      }),
      ...extra,
    },
    options
  );
};

const emitCommentEvent = ({
  eventName,
  ticketId,
  workspaceId,
  commentId,
  extra = {},
  options = {},
}) => {
  const resolvedTicketId = toSocketId(ticketId);
  const resolvedWorkspaceId = toSocketId(workspaceId);
  const resolvedCommentId = toSocketId(commentId);

  if (!resolvedTicketId) return false;

  const payload = {
    ticketId: resolvedTicketId,
    workspaceId: resolvedWorkspaceId,
    commentId: resolvedCommentId,
    scopes: buildTicketScopes({ ticketId: resolvedTicketId }),
    ...extra,
  };

  if (resolvedWorkspaceId) {
    getWorkspaceAudienceUserIds(resolvedWorkspaceId).then((audienceUserIds) =>
      broadcastToWorkspaceTicketAndUsers(
        resolvedWorkspaceId,
        resolvedTicketId,
        audienceUserIds,
        eventName,
        payload,
        options
      )
    );

    return true;
  }

  return broadcastToTicket(resolvedTicketId, eventName, payload, options);
};

// Interns/recommendations are global (not workspace-scoped), so this fans out
// to every connected client; only leadership/mentor screens hold ['interns']
// queries, so the rest simply ignore it.
const emitInternDataChanged = () =>
  broadcastToAll('CACHE_INVALIDATED', {
    scopes: [invalidationScopes.intern()],
  });

const emitDailyChanged = (workspaceId) => {
  const resolvedWorkspaceId = toSocketId(workspaceId);
  if (!resolvedWorkspaceId) return false;

  return broadcastToWorkspace(resolvedWorkspaceId, 'CACHE_INVALIDATED', {
    scopes: [invalidationScopes.workspaceDailies(resolvedWorkspaceId)],
  });
};

module.exports = {
  toSocketId,
  emitTicketEvent,
  emitCommentEvent,
  emitInternDataChanged,
  emitDailyChanged,
};
