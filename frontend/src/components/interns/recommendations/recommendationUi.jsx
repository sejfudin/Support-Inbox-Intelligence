import { Fragment } from 'react';
import { format } from 'date-fns';
import { Check, Lock, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { getRecommendationResultLabel } from '@/helpers/recommendations';

// ---- Recommendations design tokens ----
//
// The redesign was signed off as a set of exact hex values. Those hexes are now
// expressed as the app's semantic theme tokens instead, because the literals
// only rendered correctly in light mode — in dark mode this feature stayed a
// white card on a dark page. The neutral swap is visually a no-op: the approved
// hexes and the light-theme tokens agree to within ~4/255 per channel
// (#171b2b vs --foreground #1a1e2e, #dcdfe9 vs --input #dee1ed, and so on).
//
// The brand violet is the one deliberate change. It was #6d5ce6; it is now
// --primary, which is a visibly brighter violet in the default palette. That is
// intentional: hardcoding the hex also made this the only feature that ignored
// the data-theme colour-theme picker.
//
// Status tints (violet / amber / green / red) have no semantic tokens, so they
// keep an explicit palette with hand-picked dark variants.

// The redesign ships with its own system font stack, independent of the app
// theme font.
export const REC_FONT =
  "[font-family:-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,sans-serif]";

// Timeline strip colours, painted via inline `style` (RecModal's `strip`), so
// these stay literal rather than becoming utility classes.
export const STATUS_COLORS = {
  recommended: 'hsl(var(--primary))',
  interviewing: '#e2a400',
  resulted: '#17a06b',
};

// Status pill (view-modal header) tints, keyed by status.
const STATUS_PILL_CLASSES = {
  recommended: 'bg-primary/10 text-primary dark:bg-primary/20',
  interviewing: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  resulted: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
};

export const INPUT_CLASS =
  'w-full rounded-xl border border-input bg-card px-[14px] py-[11px] text-[14px] text-foreground outline-none transition placeholder:text-muted-foreground/80 focus:border-ring';

export const BTN_PRIMARY_CLASS =
  'rounded-xl bg-primary px-[18px] py-[11px] text-[14px] font-semibold text-primary-foreground shadow-[0_2px_8px_hsl(var(--primary)/.35)] transition hover:bg-primary/90';

export const BTN_PRIMARY_DISABLED_CLASS =
  'cursor-not-allowed bg-muted text-muted-foreground shadow-none hover:bg-muted';

export const BTN_SECONDARY_CLASS =
  'rounded-xl border border-input bg-card px-[18px] py-[11px] text-[14px] font-semibold text-foreground/80 transition hover:bg-accent';

export const BTN_DANGER_CLASS =
  'rounded-xl bg-destructive px-[18px] py-[11px] text-[14px] font-semibold text-destructive-foreground transition hover:bg-destructive/90';

export const BTN_DANGER_GHOST_CLASS =
  'inline-flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-[14px] font-semibold text-destructive transition hover:bg-destructive/10';

export const CHIP_CLASS =
  'inline-flex items-center rounded-full bg-muted px-3 py-[5px] text-[12.5px] font-semibold text-foreground/80';

export const formatRecDate = (date) => {
  if (!date) return 'No date';
  return format(new Date(date), 'MMM d, yyyy');
};

/** 11px uppercase section label used across cards and modals. */
export function SectionLabel({ children, className }) {
  return (
    <p
      className={cn(
        'text-[11px] font-bold uppercase tracking-[1.2px] text-muted-foreground/80',
        className
      )}
    >
      {children}
    </p>
  );
}

/** Field label used in the form modals. */
export function FieldLabel({ children, required = false, htmlFor, className }) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn('block text-[14px] font-semibold text-foreground/90', className)}
    >
      {children}
      {required && <span className="ml-1 text-destructive">*</span>}
    </label>
  );
}

/** Uppercase status pill shown next to the view-modal title. */
export function StatusPill({ status, label }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 rounded-full px-[10px] py-1 text-[11px] font-bold uppercase tracking-wide',
        STATUS_PILL_CLASSES[status] || STATUS_PILL_CLASSES.recommended
      )}
    >
      {label}
    </span>
  );
}

/**
 * High-contrast hover tooltip (shared by locked status segments and the result
 * "?" button). Pure CSS hover — no positioning library needed.
 *
 * Surfaced as `bg-foreground` / `text-background`, so it inverts against the
 * page: near-black in light mode, near-white in dark. It used to be a literal
 * #1e2130, which is all but invisible sitting on a dark-mode card.
 */
export function DarkTooltip({ content, align = 'center', wrapperClassName, children }) {
  return (
    <span className={cn('group relative inline-flex', wrapperClassName)}>
      {children}
      <span
        className={cn(
          'pointer-events-none absolute bottom-full z-30 mb-2 w-max max-w-[280px] rounded-[10px] bg-foreground px-3 py-[7px] text-left text-[12.5px] font-medium leading-relaxed text-background opacity-0 shadow-elevated transition-opacity duration-[120ms] group-hover:opacity-100',
          align === 'center' ? 'left-1/2 -translate-x-1/2' : 'left-0'
        )}
        role="tooltip"
      >
        {content}
      </span>
    </span>
  );
}

/**
 * Placement result chip: Placed (green) / Not placed (orange) / gray
 * "Awaiting result" when no outcome is recorded yet. When the result carries a
 * note, a 20px "?" help button next to the chip reveals it in a dark tooltip.
 */
export function ResultChip({ result }) {
  const outcome = result?.outcome;
  const chip = outcome ? (
    <span
      className={cn(
        'inline-flex rounded-full px-3 py-[5px] text-[12.5px] font-semibold',
        outcome === 'placed'
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
          : 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
      )}
    >
      {getRecommendationResultLabel(outcome)}
    </span>
  ) : (
    <span className="inline-flex rounded-full bg-muted px-3 py-[5px] text-[12.5px] font-semibold text-muted-foreground">
      Awaiting result
    </span>
  );

  return (
    <span className="inline-flex items-center gap-2">
      {chip}
      {outcome && result?.note && (
        <DarkTooltip
          align="left"
          content={
            <>
              <span className="font-bold">Placement note</span> — {result.note}
            </>
          }
        >
          <button
            type="button"
            onClick={(event) => event.stopPropagation()}
            className="grid h-5 w-5 cursor-help place-items-center rounded-full border border-input bg-card text-[11px] font-bold text-muted-foreground"
            aria-label="Placement note"
          >
            ?
          </button>
        </DarkTooltip>
      )}
    </span>
  );
}

// ---- Status timeline ----

/**
 * Derive the 3 timeline steps (recommended → interviewing → resulted) for a
 * recommendation record. Each step gets a visual `state`:
 * - done      reached earlier stage (has a history date)
 * - current   the recommendation's active status
 * - skipped   earlier stage with no date (e.g. interviewing skipped) — dashed
 * - pending   not reached yet
 */
export function buildTimelineSteps(recommendation, stages) {
  const dates = recommendation.statusDates || {};
  const currentIndex = stages.findIndex((stage) => stage.key === recommendation.status);
  return stages.map((stage, index) => {
    let state;
    if (index === currentIndex) state = 'current';
    else if (index < currentIndex) state = dates[stage.key] ? 'done' : 'skipped';
    else state = 'pending';
    const rawDate = dates[stage.key] || (state === 'current' ? recommendation.updatedAt : null);
    return {
      key: stage.key,
      label: stage.label,
      state,
      date: state === 'done' || state === 'current' ? formatRecDate(rawDate) : null,
    };
  });
}

const stepIsActive = (step) => step.state === 'done' || step.state === 'current';

function TimelineCircle({ step, size }) {
  const dim = 'h-[26px] w-[26px]';
  const icon = size === 'modal' ? 'h-3.5 w-3.5' : 'h-3 w-3';
  if (stepIsActive(step)) {
    return (
      <div
        className={cn(
          'grid place-items-center rounded-full bg-primary text-primary-foreground',
          dim,
          step.state === 'current' && 'shadow-[0_0_0_4px_hsl(var(--primary)/.25)]'
        )}
      >
        <Check className={icon} strokeWidth={3} />
      </div>
    );
  }
  return (
    <div
      className={cn(
        'rounded-full bg-card',
        dim,
        step.state === 'skipped'
          ? 'border-2 border-dashed border-input'
          : 'border-2 border-solid border-input'
      )}
    />
  );
}

/**
 * Full status timeline (detailed card + modals): 26px circles joined by 2px
 * connectors, fixed step columns (120px card / 130px modal), labels + dates
 * (or "Pending" / italic "Skipped") under each step.
 */
export function RecommendationTimeline({ steps, size = 'card', showCurrentTag = false }) {
  const column = size === 'modal' ? 'w-[130px]' : 'w-[120px]';
  return (
    <div className="flex items-start">
      {steps.map((step, index) => {
        const connectorActive = index > 0 && stepIsActive(step) && stepIsActive(steps[index - 1]);
        return (
          <Fragment key={step.key}>
            {index > 0 && (
              <div
                className={cn(
                  'mx-[-38px] mt-3 h-[2px] min-w-6 flex-1 rounded-full',
                  connectorActive ? 'bg-primary' : 'bg-border'
                )}
                aria-hidden="true"
              />
            )}
            <div className={cn('flex shrink-0 flex-col items-center text-center', column)}>
              <TimelineCircle step={step} size={size} />
              <span
                className={cn(
                  'mt-2 text-[13px] font-semibold',
                  stepIsActive(step) ? 'text-foreground/90' : 'text-muted-foreground/80'
                )}
              >
                {step.label}
              </span>
              {step.state === 'skipped' ? (
                <span className="text-[12px] italic text-muted-foreground/70">Skipped</span>
              ) : step.state === 'pending' ? (
                <span className="text-[12px] text-muted-foreground/80">Pending</span>
              ) : (
                <span className="text-[12px] text-muted-foreground">{step.date}</span>
              )}
              {showCurrentTag && step.state === 'current' && (
                <span className="mt-1.5 inline-flex rounded-full bg-primary/10 px-2 py-[3px] text-[10px] font-bold uppercase tracking-wide text-primary dark:bg-primary/20">
                  Current
                </span>
              )}
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}

/** Compact-card mini timeline: 12px dots joined by 26px × 2px connectors. */
export function MiniTimeline({ steps }) {
  return (
    <div className="flex shrink-0 items-center">
      {steps.map((step, index) => {
        const connectorActive = index > 0 && stepIsActive(step) && stepIsActive(steps[index - 1]);
        return (
          <Fragment key={step.key}>
            {index > 0 && (
              <div
                className={cn('h-[2px] w-[26px]', connectorActive ? 'bg-primary' : 'bg-border')}
                aria-hidden="true"
              />
            )}
            <span
              className={cn(
                'h-3 w-3 rounded-full',
                stepIsActive(step)
                  ? cn(
                      'bg-primary',
                      step.state === 'current' && 'shadow-[0_0_0_3px_hsl(var(--primary)/.25)]'
                    )
                  : step.state === 'skipped'
                    ? 'border-2 border-dashed border-input bg-card'
                    : 'border-2 border-input bg-card'
              )}
              title={step.label}
            />
          </Fragment>
        );
      })}
    </div>
  );
}

/**
 * Segmented status control (edit + create modals). Muted track, active option
 * filled with the theme primary; locked options are grayed with a padlock and
 * reveal a hover tooltip explaining why they can't be selected.
 */
export function StatusSegmented({ statuses, value, onChange, lockedValues = [], lockedHint }) {
  return (
    <div
      className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1"
      role="radiogroup"
      aria-label="Status"
      data-test="recommendation-status-select"
    >
      {statuses.map((status) => {
        const active = value === status.value;
        const locked = lockedValues.includes(status.value);
        const button = (
          <button
            key={status.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={locked}
            onClick={() => onChange(status.value)}
            className={cn(
              'inline-flex w-full items-center justify-center gap-1.5 rounded-[9px] px-3 py-[9px] text-[14px] font-semibold transition',
              active
                ? 'bg-primary text-primary-foreground shadow-[0_2px_8px_hsl(var(--primary)/.35)]'
                : locked
                  ? 'cursor-not-allowed text-muted-foreground/70'
                  : 'text-foreground/80 hover:text-foreground'
            )}
            data-test={`recommendation-status-option-${status.value}`}
          >
            {locked && <Lock className="h-3 w-3" strokeWidth={2.5} />}
            {status.label}
          </button>
        );
        if (!locked) {
          return (
            <span key={status.value} className="inline-flex w-full">
              {button}
            </span>
          );
        }
        return (
          <DarkTooltip key={status.value} content={lockedHint} wrapperClassName="w-full">
            {button}
          </DarkTooltip>
        );
      })}
    </div>
  );
}

/**
 * Modal shell for the recommendation dialogs: 680px, radius 20, structured
 * header (title / aside pill / subline / 32px ✕), scrollable body and bordered
 * footer. An optional `strip` paints the 4px status-color bar across the top.
 */
export function RecModal({
  open,
  onClose,
  title,
  titleClassName = 'text-[20px]',
  titleAside,
  subtitle,
  strip,
  children,
  footer,
  onSubmit,
  dataTest,
}) {
  const inner = (
    <>
      {strip && (
        <div className="h-1 w-full shrink-0" style={{ background: strip }} aria-hidden="true" />
      )}
      <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border/60 px-8 pb-5 pt-6">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-3">
            <DialogTitle className={cn('truncate font-bold text-foreground', titleClassName)}>
              {title}
            </DialogTitle>
            {titleAside}
          </div>
          {subtitle ? (
            <DialogDescription className="mt-1.5 text-[13.5px] text-muted-foreground">
              {subtitle}
            </DialogDescription>
          ) : (
            <DialogDescription className="sr-only">{title}</DialogDescription>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-muted text-muted-foreground transition hover:bg-accent hover:text-foreground"
          aria-label="Close"
          data-test="dialog-close-button"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-[26px] overflow-y-auto px-8 py-[26px]">
        {children}
      </div>
      {footer && (
        <div className="flex shrink-0 items-center gap-3 border-t border-border/60 px-8 py-[18px]">
          {footer}
        </div>
      )}
    </>
  );

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        hideCloseButton
        className={cn(
          'flex max-h-[90vh] max-w-[680px] flex-col gap-0 overflow-hidden rounded-[20px] border-0 bg-card p-0 text-foreground shadow-elevated sm:rounded-[20px] sm:p-0',
          REC_FONT
        )}
        data-test={dataTest}
      >
        {onSubmit ? (
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit();
            }}
          >
            {inner}
          </form>
        ) : (
          inner
        )}
      </DialogContent>
    </Dialog>
  );
}
