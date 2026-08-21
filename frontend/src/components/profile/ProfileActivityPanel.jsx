import { ACTIVITY_TONE, ACTIVITY_WINDOW_DAYS, formatActivityTime } from '@/helpers/profileActivity';
import { cn } from '@/lib/utils';

const DOT_CLASS = {
  [ACTIVITY_TONE.SUCCESS]: 'bg-[hsl(var(--tone-success))]',
  [ACTIVITY_TONE.INFO]: 'bg-[hsl(var(--tone-info))]',
  [ACTIVITY_TONE.WARNING]: 'bg-[hsl(var(--tone-warning))]',
  [ACTIVITY_TONE.NEUTRAL]: 'bg-muted-foreground/40',
};

/**
 * "Recent activity" — a merged view of what the reader has done lately, built by
 * `helpers/profileActivity.js` from data the app already has. See that file for
 * why there is no feed endpoint behind it.
 *
 * Rows are spaced, not ruled. Each is one short line with its time on the right,
 * and a hairline under every one of six would turn a light summary into a table.
 */
export function ProfileActivityPanel({ items = [], isLoading }) {
  return (
    <section className="app-card overflow-hidden" data-test="profile-activity-panel">
      <div className="flex items-center justify-between gap-3 border-b border-separator px-[18px] py-[13px]">
        <h2 className="app-card-title">Recent activity</h2>
        <span className="text-[11.5px] text-muted-foreground">
          Last {ACTIVITY_WINDOW_DAYS} days
        </span>
      </div>

      <div className="px-[18px] py-[13px]">
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="h-[18px] animate-pulse rounded bg-muted/50" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="py-2 text-[12.5px] text-muted-foreground">
            Nothing in the last {ACTIVITY_WINDOW_DAYS} days.
          </p>
        ) : (
          <ul className="flex flex-col gap-[13px]">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-[10px]">
                <span
                  className={cn(
                    'h-[6px] w-[6px] flex-none rounded-full',
                    DOT_CLASS[item.tone] || DOT_CLASS[ACTIVITY_TONE.NEUTRAL]
                  )}
                />
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground">
                  {item.title}
                </span>
                <span className="flex-none text-[11.5px] tabular-nums text-muted-foreground">
                  {formatActivityTime(item.at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
