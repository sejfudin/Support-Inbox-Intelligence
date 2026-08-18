import { CalendarCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { officeDateKey } from '@/helpers/attendance';

/**
 * The one-off announcement that attendance moves from the shared sheet into the app.
 *
 * Deliberately self-expiring rather than dismissible. It is an operational deadline,
 * not a feature tour: an intern who dismisses it on 6 August and then keeps filling
 * in the sheet is exactly the outcome this exists to prevent. So it cannot be closed
 * — and it removes itself the day after `VISIBLE_UNTIL`, which is why there is no
 * localStorage state here and nothing to clean up later.
 *
 * Dates are compared as office calendar keys (`officeDateKey`), not with local
 * `Date` arithmetic: attendance days are office days, so the notice has to flip on
 * Sarajevo's 10 August even for someone reading it from another timezone.
 *
 * **Delete this component, and its render in `InternDashboardPage`, after
 * 15 August 2026.** It is dead weight from the 16th onward — it renders `null`, so
 * nothing breaks if it is forgotten, but there is no reason to keep it.
 */
const STARTS_ON = '2026-08-10';
const VISIBLE_UNTIL = '2026-08-15';

// 'd MMMM' for a key, without pulling a date lib in for one label.
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const humanDate = (key) => {
  const [, month, day] = key.split('-').map(Number);
  return `${day} ${MONTHS[month - 1]}`;
};

export function AttendanceSwitchNotice({ className }) {
  const today = officeDateKey();
  // String comparison is safe and total on 'yyyy-MM-dd'.
  if (today > VISIBLE_UNTIL) return null;

  const live = today >= STARTS_ON;

  // Long form goes in the tooltip/title rather than the pill: inline beside the
  // greeting there is room for the headline only, and the headline alone would not
  // tell anyone the sheet is going away.
  const detail = live
    ? `Check in from this dashboard on every office day. The attendance sheet has been retired and is no longer counted — if it is the only place you marked yourself, that day will not show up. Everything you had recorded in the sheet before this has already been imported, so your history and your monthly rate are complete. Check-in is open 07:00–11:00.`
    : `Starting ${humanDate(STARTS_ON)} you check in from this dashboard on every office day. The attendance sheet is being retired and will stop being counted, so from that date the app is the only record that exists. Your earlier attendance has already been imported from the sheet — nothing is missing and there is nothing for you to re-enter. Check-in is open 07:00–11:00.`;

  return (
    <Link
      to="/my-attendance"
      // No `role="status"`: it would override the link role and stop this being
      // announced as something you can follow. A live region earned its keep while
      // this pulsed for attention; as a quiet, permanent-until-expiry link, being a
      // link is the more useful thing to announce.
      title={detail}
      aria-label={`${live ? 'Attendance is recorded here now' : `From ${humanDate(STARTS_ON)}, attendance is recorded here`}. ${detail}`}
      data-test="attendance-switch-notice"
      // Deliberately quiet: no pulse and no primary fill. It has to be *read* once,
      // and it sits next to the greeting on every load for over a week — anything
      // animated or brightly filled there becomes something to tune out, and the
      // board already spends its accent colour on the attendance card right below.
      className={cn(
        'flex shrink-0 items-center gap-2.5 rounded-[var(--r-control)] border border-border bg-card px-3 py-1.5 text-left transition-colors',
        'hover:border-primary/40 hover:bg-primary/[0.04]',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
      )}
    >
      <CalendarCheck className="size-4 shrink-0 text-primary" />

      <span className="min-w-0">
        <span className="block text-xs font-semibold leading-4 text-foreground">
          {live ? (
            <>Attendance is recorded here now</>
          ) : (
            <>From {humanDate(STARTS_ON)}, attendance is recorded here</>
          )}
        </span>
        {/* Two facts, both of which pre-empt a question someone would otherwise ask:
            the sheet is going away, and their old days are not lost with it. */}
        <span className="block text-[11px] leading-4 text-muted-foreground">
          {live
            ? 'Sheet retired · your past days are already in'
            : 'Sheet is being retired · your past days are already in'}
        </span>
      </span>
    </Link>
  );
}
