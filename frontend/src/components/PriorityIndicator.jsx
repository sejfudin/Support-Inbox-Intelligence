import { PRIORITY_CONFIG } from '@/helpers/ticketPriority';

export default function PriorityIndicator({ priority }) {
  const p = priority?.toLowerCase() || 'medium';
  const config = PRIORITY_CONFIG[p];

  if (!config || !config.showAlways) {
    return null;
  }

  const Icon = config.icon;

  return (
    <div
      className="flex items-center gap-1.5 text-muted-foreground"
      title={`Priority: ${config.label}`}
    >
      <Icon className="h-4 w-4" />
      <span className={`text-sm font-medium ${config.className}`}>{config.label}</span>
    </div>
  );
}
