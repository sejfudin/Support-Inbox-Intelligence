import { PRIORITY_CONFIG } from '@/helpers/ticketPriority';

// The two sizes the overhauled screens ask for; `default` is the pre-overhaul one
// and is left alone because the dashboards' frozen list still renders it.
const SIZES = {
  board: { icon: 'h-3 w-3', label: 'text-[11.5px] font-medium', gap: 'gap-[5px]' },
  list: { icon: 'h-[13px] w-[13px]', label: 'text-[12px] font-medium', gap: 'gap-1.5' },
  default: { icon: 'h-4 w-4', label: 'text-sm font-medium', gap: 'gap-1.5' },
};

export default function PriorityIndicator({ priority, size = 'default' }) {
  const p = priority?.toLowerCase() || 'medium';
  const config = PRIORITY_CONFIG[p];

  if (!config || !config.showAlways) {
    return null;
  }

  const Icon = config.icon;
  const scale = SIZES[size] || SIZES.default;

  return (
    <div
      className={`flex items-center ${scale.gap} text-muted-foreground`}
      title={`Priority: ${config.label}`}
    >
      <Icon className={scale.icon} strokeWidth={2} />
      <span className={`${scale.label} ${config.className}`}>{config.label}</span>
    </div>
  );
}
