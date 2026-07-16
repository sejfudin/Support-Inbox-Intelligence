import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Horizontal status stepper: circles connected by lines, one node per step.
 * Reached steps show a filled accent circle with a check and are joined by a
 * solid accent line; the current step gets an accent ring; future steps are
 * hollow/muted and joined by a dashed faint line. Each node shows its date
 * below (or "Not yet" when unreached).
 *
 * @param {Array<{key:string,label:string,date?:string|null,reached:boolean,current:boolean}>} steps
 * @param {'sm'|'md'} [size]  sm = card density, md = modal
 * @param {boolean} [showCurrentTag]  render a "Current" chip under the active step (modal)
 */
export function StatusTimeline({ steps, size = 'sm', showCurrentTag = false }) {
  const dot = size === 'md' ? 'h-7 w-7' : 'h-6 w-6';
  const icon = size === 'md' ? 'h-3.5 w-3.5' : 'h-3 w-3';

  return (
    <div className="flex items-start">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        // The connector to the NEXT node is solid+accent only when both this and
        // the next step are reached; otherwise dashed+muted.
        const nextReached = !isLast && steps[index + 1].reached;
        return (
          <div key={step.key} className="flex min-w-0 flex-1 flex-col items-center">
            <div className="flex w-full items-center">
              {/* spacer so the first node's left half has no line */}
              <div className="h-px flex-1">
                {index > 0 && (
                  <div
                    className={cn(
                      'h-px w-full',
                      step.reached ? 'bg-primary' : 'border-t border-dashed border-border'
                    )}
                  />
                )}
              </div>
              <div className="relative shrink-0">
                {/* Pulsating "intern is here now" indicator on the current step.
                    Disabled under prefers-reduced-motion. */}
                {step.current && (
                  <span
                    className={cn(
                      'absolute inset-0 rounded-full bg-primary/40 motion-safe:animate-ping',
                      dot
                    )}
                    aria-hidden="true"
                  />
                )}
                <div
                  className={cn(
                    'relative grid place-items-center rounded-full transition',
                    dot,
                    step.reached
                      ? 'bg-primary text-primary-foreground'
                      : 'border-2 border-border bg-card text-transparent',
                    step.current && 'ring-2 ring-primary/40 ring-offset-2 ring-offset-card'
                  )}
                >
                  {step.reached && <Check className={icon} strokeWidth={3} />}
                </div>
              </div>
              <div className="h-px flex-1">
                {!isLast && (
                  <div
                    className={cn(
                      'h-px w-full',
                      nextReached ? 'bg-primary' : 'border-t border-dashed border-border'
                    )}
                  />
                )}
              </div>
            </div>
            <div className="mt-2 flex flex-col items-center text-center">
              <span
                className={cn(
                  'text-xs font-semibold',
                  step.reached ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {step.label}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {step.date || (step.reached ? '' : 'Not yet')}
              </span>
              {showCurrentTag && step.current && (
                <span className="mt-1 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                  Current
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
