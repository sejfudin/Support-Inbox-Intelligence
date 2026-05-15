import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function TicketStatusBadge({ status, className, statusBadgeConfig = {} }) {
  const s = status?.toLowerCase();
  const current = statusBadgeConfig[s] || { variant: 'outline', className: '' };

  return (
    <Badge
      variant={current.variant}
      className={cn(
        'capitalize font-semibold px-2.5 py-0.5 border shadow-none transition-none',
        current.className,
        className
      )}
      style={current.color ? { borderColor: `${current.color}55`, color: current.color } : undefined}
    >
      {status}
    </Badge>
  );
}
