import { Badge } from '@/components/ui/badge';
import {
  getStaffingRequestStatusLabel,
  getStaffingRequestStatusTone,
} from '@/helpers/staffingRequests';

// The helper's tones, mapped onto the app's badge variants. `active` is an open
// request — the neutral outline, because "open" is the resting state of every
// request on this page and a coloured chip on all of them says nothing.
const TONE_VARIANT = {
  active: 'outline',
  placed: 'success',
  danger: 'destructive',
  warning: 'warning',
  muted: 'secondary',
};

/**
 * Open, or the close reason. Never a derived state — a request has exactly one
 * chip, and "nobody put forward yet" or "demand met" are banners, not chips.
 * Fulfilled and declined must not both read as a grey "Closed": they are
 * opposite outcomes and the list has to tell them apart at a glance.
 *
 * The admin-side twin of `symphony/requests/RequestStatusBadge`. Same helper,
 * same vocabulary, drawn with the app's `Badge` instead of the symphony surface's
 * — see `components/requests/README` note in `RequestDetailPane` for why this
 * page no longer borrows leadership's chrome.
 */
export function RequestStatusChip({ request, className }) {
  const tone = getStaffingRequestStatusTone(request);

  return (
    <Badge variant={TONE_VARIANT[tone] ?? 'secondary'} className={className}>
      {getStaffingRequestStatusLabel(request)}
    </Badge>
  );
}
