import { cn } from '@/lib/utils';

const STATUS_TONE = {
  active: 'symphony-status-active',
  ready: 'symphony-status-ready',
  placed: 'symphony-status-placed',
  completed: 'symphony-status-muted',
  discontinued: 'symphony-status-muted',
};

export function SymphonyStatusBadge({ status, className }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize',
        STATUS_TONE[status] || 'symphony-status-muted',
        className
      )}
    >
      {status}
    </span>
  );
}
