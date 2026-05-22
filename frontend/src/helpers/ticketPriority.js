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
    className: 'text-red-600 dark:text-red-400',
    dot: dotTone('danger'),
    badge: badgeTone('danger'),
    label: 'Critical',
    showAlways: true,
  },
  high: {
    icon: ArrowUp,
    className: 'text-orange-600 dark:text-orange-400',
    dot: dotTone('orange'),
    badge: badgeTone('orange'),
    label: 'High',
    showAlways: true,
  },
  medium: {
    icon: Minus,
    className: 'text-blue-600 dark:text-blue-400',
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
