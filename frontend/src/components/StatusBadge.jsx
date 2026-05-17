import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { extractStatusSlug } from '@/helpers/normalizeTicket';

export default function TicketStatusBadge({ status, className, statusBadgeConfig = {} }) {
  const statusSlug = extractStatusSlug(status);
  const s = statusSlug.toLowerCase();
  const current = statusBadgeConfig[s] || { variant: 'outline', className: '' };
  const displayLabel = current.label || statusSlug;

  return (
    <Badge
      variant={current.variant}
      className={cn(
        'font-semibold px-2.5 py-0.5 border shadow-none transition-none',
        current.className,
        className
      )}
      style={current.color ? { borderColor: `${current.color}55`, color: current.color } : undefined}
    >
      {displayLabel}
    </Badge>
  );
}
