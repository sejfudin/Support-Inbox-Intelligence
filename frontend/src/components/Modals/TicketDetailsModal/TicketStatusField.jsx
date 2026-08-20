import StatusDropdown from '@/components/StatusDropdown';
import TicketStatusBadge from '@/components/StatusBadge';

import { cn } from '@/lib/utils';

export function TicketStatusField({
  isArchived,
  ticket,
  currentStatus,
  onStatusChange,
  statusOptions,
  statusBadgeConfig,
  className,
}) {
  if (isArchived) {
    return <TicketStatusBadge status={ticket?.status} statusBadgeConfig={statusBadgeConfig} flat />;
  }

  return (
    <StatusDropdown
      status={currentStatus}
      onChange={onStatusChange}
      statusOptions={statusOptions}
      className={cn('w-full justify-between', className)}
    />
  );
}
