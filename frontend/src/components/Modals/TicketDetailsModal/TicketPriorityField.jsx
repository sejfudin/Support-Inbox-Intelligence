import PriorityDropdown from '@/components/PriorityDropdown';
import PriorityIndicator from '@/components/PriorityIndicator';

export function TicketPriorityField({ isArchived, ticket, currentPriority, onPriorityChange }) {
  if (isArchived) {
    return (
      <div className="px-1 py-2">
        <PriorityIndicator priority={ticket?.priority} />
      </div>
    );
  }

  return (
    <PriorityDropdown
      priority={currentPriority}
      onChange={onPriorityChange}
      className="w-full justify-between"
    />
  );
}
