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
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold capitalize',
        STATUS_TONE[status] || 'symphony-status-muted',
        className
      )}
    >
      <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
      {status}
    </span>
  );
}
