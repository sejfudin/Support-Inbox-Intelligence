import { useNavigate } from 'react-router-dom';
import { CalendarClock, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCheckInReminder } from '@/hooks/useCheckInReminder';

/**
 * Reminder shown on the intern dashboard while today's check-in is still
 * pending. Disappears automatically once the intern checks in (or cancels, or
 * the window closes) — see useCheckInReminder. Renders nothing when inactive,
 * so the surrounding layout collapses cleanly (no empty padded slot).
 */
export default function DashboardCheckInReminder({ className }) {
  const navigate = useNavigate();
  const { active, body } = useCheckInReminder();

  if (!active) return null;

  return (
    <div className={className}>
      <div
        className="flex flex-col gap-3 overflow-hidden rounded-[var(--r-card)] border border-[hsl(var(--tone-warning)/0.2)] bg-[hsl(var(--tone-warning)/0.06)] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
        data-test="dashboard-check-in-reminder"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--r-card)] bg-[hsl(var(--tone-warning)/0.15)] text-[hsl(var(--tone-warning-fg))]">
            <CalendarClock className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Don't forget to check in</p>
            <p className="text-sm text-muted-foreground">{body}</p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0 self-start border-[hsl(var(--tone-warning)/0.4)] text-[hsl(var(--tone-warning-fg))] hover:bg-[hsl(var(--tone-warning)/0.1)] hover:text-[hsl(var(--tone-warning-fg))] sm:self-auto dark:text-[hsl(var(--tone-warning-fg))] dark:hover:text-[hsl(var(--tone-warning-fg))]"
          onClick={() => navigate('/my-attendance')}
          data-test="dashboard-check-in-reminder-button"
        >
          Check in
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
