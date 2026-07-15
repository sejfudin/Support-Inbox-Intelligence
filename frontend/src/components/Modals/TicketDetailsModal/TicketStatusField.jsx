import StatusDropdown from '@/components/StatusDropdown';
import TicketStatusBadge from '@/components/StatusBadge';

export function TicketStatusField({
  isArchived,
  ticket,
  currentStatus,
  onStatusChange,
  statusOptions,
  statusBadgeConfig,
}) {
  if (isArchived) {
    return (
      <div className="px-1 py-2">
        <TicketStatusBadge status={ticket?.status} statusBadgeConfig={statusBadgeConfig} />
      </div>
    );
  }

  return (
    <StatusDropdown
      status={currentStatus}
      onChange={onStatusChange}
      statusOptions={statusOptions}
      className="w-full justify-between"
    />
  );
}
