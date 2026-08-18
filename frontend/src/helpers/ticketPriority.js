import { AlertCircle, Minus, ArrowUp, ArrowDown } from 'lucide-react';

import { badgeTone, dotTone } from '@/helpers/badgeTones';

export const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

/**
 * Sort weight per priority. The board's in-column sort and the priority-filter
 * asc/desc toggle both order by this, so it lives here with the rest of the
 * priority semantics rather than once per caller. Callers pick their own
 * fallback for an unknown value — they do not agree on one.
 */
export const PRIORITY_RANK = { critical: 4, high: 3, medium: 2, low: 1 };

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
