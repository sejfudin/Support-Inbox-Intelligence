import { cn } from '@/lib/utils';

/**
 * Extra props land on the panel element, so a caller can attach a `data-tour`
 * anchor or a `data-test` hook without dropping down to a raw div and re-deriving
 * the panel styling. Same pattern as `components/dashboard/DashboardCard`.
 *
 * `dense` is the overhaul mockup's card padding — 15px top, 18px elsewhere. Opt-in
 * rather than the default because the history panels behind the evaluations,
 * recommendations and mentor-notes tabs are out of the overhaul's scope and must
 * keep the roomier padding they render with today.
 */
export function InternPanel({ children, className, dense = false, ...rest }) {
  return (
    <div
      className={cn('app-card', dense ? 'p-[18px] pt-[15px]' : 'p-5 md:p-6', className)}
      {...rest}
    >
      {children}
    </div>
  );
}
