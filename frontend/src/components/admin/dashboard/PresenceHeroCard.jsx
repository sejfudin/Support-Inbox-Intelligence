import { useState } from 'react';
import { UserRound, UsersRound } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getAvatarColor } from '@/helpers/avatarColor';
import { getInitials } from '@/helpers/getInitials';

// The check-in window is 07:00–11:00 office time (server-owned — see
// helpers/attendanceTime.js). Which end of it matters depends on where "now"
// falls, so the badge reads differently in each state instead of always showing
// a deadline that may already have passed.
const windowBadge = (checkInWindow) => {
  if (!checkInWindow) return null;
  const hour12 = (hour) => (hour % 12 === 0 ? 12 : hour % 12);
  switch (checkInWindow.state) {
    case 'open':
      return `until ${hour12(checkInWindow.endHour)} AM`;
    case 'before':
      return `opens ${checkInWindow.label.split('–')[0]}`;
    default:
      return 'check-in closed';
  }
};

export function PresenceHeroCard({ presence }) {
  const [showAbsent, setShowAbsent] = useState(false);

  const presentToday = presence?.presentToday ?? 0;
  const totalInterns = presence?.totalInterns ?? 0;
  const absentToday = presence?.absentToday ?? [];
  const badge = windowBadge(presence?.checkInWindow);
  const pct = totalInterns > 0 ? Math.round((presentToday / totalInterns) * 100) : 0;

  return (
    <>
      <section
        data-tour="dashboard-presence"
        className="admin-hero-surface flex min-h-[12.5rem] flex-col justify-between rounded-[1.25rem] p-4 sm:p-5"
        aria-label="Team present today"
      >
        <div>
          <header className="flex items-start justify-between gap-2">
            <h2 className="admin-hero-muted text-[11px] font-semibold uppercase leading-4 tracking-[0.16em]">
              Team present today
            </h2>
            {badge && (
              <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-white/80">
                {badge}
              </span>
            )}
          </header>

          <p className="mt-3 flex flex-wrap items-baseline gap-x-2">
            <span className="admin-hero-text text-5xl font-semibold leading-none tabular-nums">
              {presentToday}
            </span>
            <span className="admin-hero-muted text-sm font-medium">
              / {totalInterns} {totalInterns === 1 ? 'intern' : 'interns'} in
            </span>
          </p>

          <div
            className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/15"
            role="img"
            aria-label={`${presentToday} of ${totalInterns} interns checked in`}
          >
            <div
              className="h-full rounded-full bg-white/85 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="admin-hero-muted mt-2 text-[11px]">
            {presence?.monthAttendanceRate ?? 0}% avg attendance this month
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAbsent(true)}
          disabled={absentToday.length === 0}
          data-test="admin-dashboard-absent-button"
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2.5 text-xs font-semibold text-white/90 transition-colors hover:bg-white/[0.18] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <UsersRound className="h-3.5 w-3.5" />
          {absentToday.length === 0 ? 'Everyone is in' : 'See who is absent'}
        </button>
      </section>

      <Dialog open={showAbsent} onOpenChange={setShowAbsent}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Absent today</DialogTitle>
            <DialogDescription>
              {absentToday.length} of {totalInterns} interns have not checked in. Absence is derived
              from the missing check-in, not recorded directly.
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {absentToday.map((intern) => (
              <li key={intern.id} className="flex items-center gap-3 rounded-xl px-1 py-2">
                <span
                  className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${getAvatarColor(intern.fullname || intern.email || '?')}`}
                >
                  {intern.fullname ? (
                    getInitials(intern.fullname)
                  ) : (
                    <UserRound className="h-4 w-4" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {intern.fullname || intern.email}
                  </span>
                  {intern.position && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {intern.position}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
