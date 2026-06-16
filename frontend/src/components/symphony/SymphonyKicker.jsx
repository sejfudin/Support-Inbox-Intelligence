import { cn } from '@/lib/utils';

export function SymphonyKicker({ children, className }) {
  return <span className={cn('symphony-kicker', className)}>{children}</span>;
}
