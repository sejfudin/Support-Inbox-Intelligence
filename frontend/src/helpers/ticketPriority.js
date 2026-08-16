import { AlertCircle, Minus, ArrowUp, ArrowDown } from 'lucide-react';

import { badgeTone, dotTone } from '@/helpers/badgeTones';

export const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

export const PRIORITY_CONFIG = {
  critical: {
    icon: AlertCircle,
    className: 'text-[hsl(var(--tone-danger-fg))]',
    dot: dotTone('danger'),
    badge: badgeTone('danger'),
    label: 'Critical',
    showAlways: true,
  },
  high: {
    icon: ArrowUp,
    className: 'text-[hsl(var(--tone-orange-fg))]',
    dot: dotTone('orange'),
    badge: badgeTone('orange'),
    label: 'High',
    showAlways: true,
  },
  medium: {
    icon: Minus,
    className: 'text-[hsl(var(--tone-info-fg))]',
    dot: dotTone('info'),
    badge: badgeTone('info'),
    label: 'Medium',
    showAlways: true,
  },
  low: {
    icon: ArrowDown,
    className: 'text-muted-foreground',
    dot: dotTone('neutral'),
    badge: badgeTone('neutral'),
    label: 'Low',
    showAlways: true,
  },
};

export const getPriorityLabel = (priority) => {
  const option = PRIORITY_OPTIONS.find((p) => p.value === priority?.toLowerCase());
  return option?.label || priority || 'Medium';
};
