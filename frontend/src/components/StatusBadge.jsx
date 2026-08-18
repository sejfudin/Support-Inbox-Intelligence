import { cn } from '@/lib/utils';
import { CHIP } from '@/helpers/badgeTones';
import { extractStatusSlug } from '@/helpers/normalizeTicket';

/**
 * A ticket's status, as the app's one chip.
 *
 * A `<span>` and not `components/ui/badge` for one reason: a workspace picks its
 * own status colours and stores them as hex on the status record, so the colour
 * arrives as data and has to go through `style`. The geometry still comes from
 * `CHIP`, which is `Badge`'s base — so this stays the same size and shape as
 * every other badge without being able to drift from it.
 *
 * There used to be a second, bordered look here selected by a `flat` prop, which
 * is how the ticket list and the ticket modal ended up showing the same status
 * two different ways.
 */
export default function TicketStatusBadge({ status, className, statusBadgeConfig = {} }) {
  const statusSlug = extractStatusSlug(status);
  const current = statusBadgeConfig[statusSlug.toLowerCase()] || {};
  const displayLabel = current.label || statusSlug;

  return (
    <span
      className={cn(CHIP, current.color ? null : 'bg-muted text-muted-foreground', className)}
      style={
        current.color ? { color: current.color, backgroundColor: `${current.color}1f` } : undefined
      }
    >
      {displayLabel}
    </span>
  );
}
