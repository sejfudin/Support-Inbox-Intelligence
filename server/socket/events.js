const { broadcastToTicket, broadcastToWorkspaceAndTicket } = require('./socketServer');
const { invalidationScopes } = require('./invalidationScopes');

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

const emitTicketEvent = ({ eventName, ticketId, workspaceId, extra = {}, options = {} }) => {
  const resolvedTicketId = toSocketId(ticketId);
  const resolvedWorkspaceId = toSocketId(workspaceId);

  if (!resolvedTicketId || !resolvedWorkspaceId) return false;

  return broadcastToWorkspaceAndTicket(
    resolvedWorkspaceId,
    resolvedTicketId,
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
    return broadcastToWorkspaceAndTicket(
      resolvedWorkspaceId,
      resolvedTicketId,
      eventName,
      payload,
      options
    );
  }

  return broadcastToTicket(
    resolvedTicketId,
    eventName,
    payload,
    options
  );
};

module.exports = {
  toSocketId,
  emitTicketEvent,
  emitCommentEvent,
};
