import { buildCsv, downloadCsvFile, formatCsvDate } from '@/helpers/csvExport';

export const exportTicketToCsv = (ticket, { title, description, currentStatus, helpers }) => {
  const numericId = ticket.taskNumber ?? ticket.ticketNumber ?? null;
  const rawId = ticket.id || ticket._id || ticket.ticketId || '';
  const id = numericId != null ? numericId : rawId || 'ticket';
  const titleValue = title || ticket.subject || ticket.title || 'Untitled';
  const shortSubject = String(titleValue).slice(0, 40).trim().replace(/\s+/g, '-');

  const assignee =
    (ticket.assignedTo || [])
      .map((p) => p?.fullname || p?.fullName || p?.email || '')
      .filter(Boolean)
      .join('; ') || 'Unassigned';

  const workspaceName =
    ticket.workspace?.name ||
    ticket.workspaceName ||
    (typeof ticket.workspace === 'string' ? ticket.workspace : ticket.workspace?._id || '');

  const commentsCount =
    ticket.comments?.length ?? ticket.messages?.length ?? ticket.activity?.length ?? '';

  const header = [
    'id',
    'title',
    'description',
    'status',
    'priority',
    'assignee',
    'workspace',
    'commentsCount',
    'createdAt',
    'updatedAt',
    'dueDate',
  ];

  const row = [
    id,
    titleValue,
    description || ticket.description || '',
    helpers.resolveStatusLabel(ticket.status) || helpers.resolveStatusLabel(currentStatus) || '',
    ticket.priority || '',
    assignee,
    workspaceName,
    commentsCount,
    formatCsvDate(ticket.createdAt),
    formatCsvDate(ticket.updatedAt),
    ticket.dueDate || '',
  ];

  const idPart = numericId != null ? `T${numericId}` : '';
  const baseName = idPart
    ? `ticket-${idPart}-${shortSubject || 'export'}`
    : `ticket-${shortSubject || 'export'}`;
  const csv = buildCsv(header, [row]);
  downloadCsvFile(`${baseName}.csv`, csv);
};
