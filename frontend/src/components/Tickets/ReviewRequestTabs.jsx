import { cn } from '@/lib/utils';
import { REVIEW_REQUEST_FILTER_OPTIONS } from '@/helpers/ticketFilters';

/**
 * A second row of pills under the status tabs — same visual language as
 * `TicketsTabs`, one pill per review-request state, scoped to requests
 * addressed to the signed-in reviewer. Admin/mentor only: interns are never
 * a request's reviewer, so the row would always read empty for them.
 */
export default function ReviewRequestTabs({ activeFilter, counts = {}, onChange }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-0.5" data-test="review-request-tabs">
      <span className="mr-1 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/75">
        My review requests
      </span>
      {REVIEW_REQUEST_FILTER_OPTIONS.map((option) => {
        const active = activeFilter === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            data-test={`review-request-tab-${option.value}`}
            className={cn(
              'flex h-8 flex-none items-center gap-[7px] whitespace-nowrap rounded-[var(--r-control)] px-3 text-[12.5px] transition-colors',
              active
                ? 'bg-primary/10 font-semibold text-primary'
                : 'font-medium text-muted-foreground hover:text-foreground'
            )}
          >
            <span>{option.label}</span>
            {typeof counts[option.value] === 'number' ? (
              <span
                className={cn(
                  'ml-1.5 text-[11px] font-semibold tabular-nums',
                  active ? 'text-primary' : 'text-muted-foreground/75'
                )}
              >
                {counts[option.value]}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
