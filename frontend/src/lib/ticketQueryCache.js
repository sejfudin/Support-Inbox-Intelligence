import { extractStatusId, extractStatusSlug } from '@/helpers/normalizeTicket';

const getTicketId = (ticket) => ticket?._id ?? ticket?.id ?? ticket?.ticketId ?? ticket?.uuid;

const getTickets = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  return null;
};

const withTickets = (data, tickets) => {
  if (Array.isArray(data)) return tickets;
  return { ...data, data: tickets };
};

const getQueryParams = (queryKey = []) => {
  if (queryKey[0] !== 'tickets') return {};
  if (queryKey[1] && typeof queryKey[1] === 'object') return queryKey[1];
  if (queryKey[2] && typeof queryKey[2] === 'object') return queryKey[2];
  return {};
};

const normalizeBoolParam = (value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value;
  return String(value) === 'true';
};

const parseCsv = (value) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const ticketMatchesQuery = (ticket, queryKey) => {
  const params = getQueryParams(queryKey);
  const archivedParam = normalizeBoolParam(params.archived);
  const isArchived = Boolean(ticket?.isArchived);

  if (archivedParam !== null && archivedParam !== isArchived) return false;
  if (archivedParam === null && isArchived) return false;

  const statusId = extractStatusId(ticket?.status);
  const statusSlug = extractStatusSlug(ticket?.status);
  const statusFilter = String(params.statusId || params.status || '').trim();
  if (statusFilter && statusFilter !== 'all' && statusFilter !== 'not_null') {
    if (statusFilter !== statusId && statusFilter !== statusSlug) return false;
  }

  const priorities = parseCsv(params.priorities || params.priority).map((priority) =>
    priority.toLowerCase()
  );
  if (priorities.length > 0 && !priorities.includes(String(ticket?.priority || '').toLowerCase())) {
    return false;
  }

  const search = String(params.search || '')
    .trim()
    .toLowerCase();
  if (search) {
    const haystack = `${ticket?.subject || ''} ${ticket?.title || ''} ${ticket?.description || ''}`
      .trim()
      .toLowerCase();
    if (!haystack.includes(search)) return false;
  }

  const assigneeIds = parseCsv(params.assigneeIds);
  if (assigneeIds.length > 0) {
    const assignedIds = new Set(
      (ticket?.assignedTo || []).map((assignee) =>
        String(assignee?._id || assignee?.id || assignee)
      )
    );
    const wantsUnassigned = assigneeIds.includes('unassigned');
    const hasAssigneeMatch = assigneeIds.some(
      (assigneeId) => assigneeId !== 'unassigned' && assignedIds.has(assigneeId)
    );
    if (!hasAssigneeMatch && !(wantsUnassigned && assignedIds.size === 0)) return false;
  }

  return true;
};

const patchQueryData = (queryClient, updater) => {
  let patchedAny = false;
  const queries = queryClient.getQueriesData({ queryKey: ['tickets'] });

  queries.forEach(([queryKey, currentData]) => {
    const currentTickets = getTickets(currentData);
    if (!currentTickets) return;

    const nextTickets = updater({ queryKey, currentData, currentTickets });
    if (nextTickets === currentTickets) return;

    patchedAny = true;
    queryClient.setQueryData(queryKey, withTickets(currentData, nextTickets));
  });

  return patchedAny;
};

export const patchTicketListQueries = (queryClient, ticketId, patchTicket) => {
  if (!ticketId || typeof patchTicket !== 'function') return false;

  return patchQueryData(queryClient, ({ currentTickets }) => {
    let changed = false;
    const nextTickets = currentTickets.map((ticket) => {
      if (String(getTicketId(ticket)) !== String(ticketId)) return ticket;

      changed = true;
      return patchTicket(ticket);
    });

    return changed ? nextTickets : currentTickets;
  });
};

export const patchMovedTicketInLists = (queryClient, { ticketId, status, statusId, ticket }) => {
  const nextStatus = status || statusId;
  if (!ticketId || !nextStatus) return false;

  return patchQueryData(queryClient, ({ queryKey, currentTickets }) => {
    const index = currentTickets.findIndex(
      (currentTicket) => String(getTicketId(currentTicket)) === String(ticketId)
    );
    if (index < 0) return currentTickets;

    const patchedTicket = {
      ...currentTickets[index],
      ...(ticket || {}),
      status: ticket?.status ?? nextStatus,
    };

    if (!ticketMatchesQuery(patchedTicket, queryKey)) {
      return currentTickets.filter((_, currentIndex) => currentIndex !== index);
    }

    const nextTickets = [...currentTickets];
    nextTickets[index] = patchedTicket;
    return nextTickets;
  });
};

export const upsertTicketInLists = (queryClient, ticket) => {
  const ticketId = getTicketId(ticket);
  if (!ticketId) return false;

  return patchQueryData(queryClient, ({ queryKey, currentTickets }) => {
    const index = currentTickets.findIndex(
      (currentTicket) => String(getTicketId(currentTicket)) === String(ticketId)
    );
    const shouldBeInQuery = ticketMatchesQuery(ticket, queryKey);

    if (index >= 0) {
      if (!shouldBeInQuery) {
        return currentTickets.filter((_, currentIndex) => currentIndex !== index);
      }

      const nextTickets = [...currentTickets];
      nextTickets[index] = {
        ...currentTickets[index],
        ...ticket,
      };
      return nextTickets;
    }

    if (!shouldBeInQuery) return currentTickets;

    return [ticket, ...currentTickets];
  });
};

export const removeTicketFromLists = (queryClient, ticketId) => {
  if (!ticketId) return false;

  return patchQueryData(queryClient, ({ currentTickets }) => {
    const nextTickets = currentTickets.filter(
      (ticket) => String(getTicketId(ticket)) !== String(ticketId)
    );
    return nextTickets.length === currentTickets.length ? currentTickets : nextTickets;
  });
};
