import { cn } from '@/lib/utils';

const STATUS_TONE = {
  active: 'symphony-status-active',
  ready: 'symphony-status-ready',
  placed: 'symphony-status-placed',
  completed: 'symphony-status-muted',
  discontinued: 'symphony-status-muted',
  // Project statuses (active/completed already covered above).
  on_hold: 'symphony-status-ready',
};

// `label` overrides the displayed text (default: the raw `status` value) —
// needed for snake_case statuses like the project `on_hold`, which would
// otherwise render its literal underscore.
export function SymphonyStatusBadge({ status, label, className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold capitalize',
        STATUS_TONE[status] || 'symphony-status-muted',
        className
      )}
    >
      <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
      {label ?? status}
    </span>
  );
}
