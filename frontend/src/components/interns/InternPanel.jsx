import { cn } from '@/lib/utils';

/**
 * Extra props land on the panel element, so a caller can attach a `data-tour`
 * anchor or a `data-test` hook without dropping down to a raw div and re-deriving
 * the panel styling. Same pattern as `components/dashboard/DashboardCard`.
 */
export function InternPanel({ children, className, ...rest }) {
  return (
    <div className={cn('app-panel p-5 md:p-6', className)} {...rest}>
      {children}
    </div>
  );
}
