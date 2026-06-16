import { cn } from '@/lib/utils';

export function InternPanel({ children, className }) {
  return <div className={cn('app-panel p-5 md:p-6', className)}>{children}</div>;
}
