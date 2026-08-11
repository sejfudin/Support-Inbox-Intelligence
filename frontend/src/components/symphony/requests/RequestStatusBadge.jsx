import { SymphonyStatusBadge } from '@/components/symphony/SymphonyStatusBadge';
import {
  getStaffingRequestStatusLabel,
  getStaffingRequestStatusTone,
} from '@/helpers/staffingRequests';

/**
 * Open, or the close reason. Never a derived state — a request has exactly one
 * badge, and "nobody put forward yet" or "demand met" are banners, not badges.
 * Fulfilled and declined must not both read as a grey "Closed": they are
 * opposite outcomes and the list has to tell them apart at a glance.
 */
export function RequestStatusBadge({ request, className }) {
  return (
    <SymphonyStatusBadge
      status={getStaffingRequestStatusTone(request)}
      label={getStaffingRequestStatusLabel(request)}
      className={className}
    />
  );
}
