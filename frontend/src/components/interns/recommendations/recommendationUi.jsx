import { Fragment } from 'react';
import { format } from 'date-fns';
import { Check, Lock, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { getRecommendationResultLabel } from '@/helpers/recommendations';

// ---- Recommendations design tokens (approved redesign — exact values) ----

// The redesign ships with its own system font stack, independent of the app
// theme font.
export const REC_FONT =
  "[font-family:-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,sans-serif]";

export const STATUS_COLORS = {
  recommended: '#6d5ce6',
  interviewing: '#e2a400',
  resulted: '#17a06b',
};

// Status pill (view-modal header) tints, keyed by status.
const STATUS_PILL_CLASSES = {
  recommended: 'bg-[#eceafc] text-[#5a48d6]',
  interviewing: 'bg-[#fef4e2] text-[#b06a05]',
  resulted: 'bg-[#e2f5ec] text-[#157a52]',
};

export const INPUT_CLASS =
  'w-full rounded-xl border border-[#dcdfe9] bg-white px-[14px] py-[11px] text-[14px] text-[#171b2b] outline-none transition placeholder:text-[#9aa1b4] focus:border-[#6d5ce6]';

export const BTN_PRIMARY_CLASS =
  'rounded-xl bg-[#6d5ce6] px-[18px] py-[11px] text-[14px] font-semibold text-white shadow-[0_2px_8px_rgba(109,92,230,.35)] transition hover:bg-[#5a48d6]';

export const BTN_PRIMARY_DISABLED_CLASS =
  'cursor-not-allowed bg-[#d7dae4] text-[#9298ab] shadow-none hover:bg-[#d7dae4]';

export const BTN_SECONDARY_CLASS =
  'rounded-xl border border-[#dcdfe9] bg-white px-[18px] py-[11px] text-[14px] font-semibold text-[#4a5064] transition hover:bg-[#f7f8fb]';

export const BTN_DANGER_CLASS =
  'rounded-xl bg-[#d64c4c] px-[18px] py-[11px] text-[14px] font-semibold text-white transition hover:bg-[#c04040]';

export const BTN_DANGER_GHOST_CLASS =
  'inline-flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-[14px] font-semibold text-[#c04545] transition hover:bg-[#fdf1f1]';

export const CHIP_CLASS =
  'inline-flex items-center rounded-full bg-[#f2f3f7] px-3 py-[5px] text-[12.5px] font-semibold text-[#3c4257]';

export const formatRecDate = (date) => {
  if (!date) return 'No date';
  return format(new Date(date), 'MMM d, yyyy');
};

/** 11px uppercase section label used across cards and modals. */
export function SectionLabel({ children, className }) {
  return (
    <p className={cn('text-[11px] font-bold uppercase tracking-[1.2px] text-[#9aa1b4]', className)}>
      {children}
    </p>
  );
}

/** Field label used in the form modals. */
export function FieldLabel({ children, required = false, htmlFor, className }) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn('block text-[14px] font-semibold text-[#33384c]', className)}
    >
      {children}
      {required && <span className="ml-1 text-[#d64c4c]">*</span>}
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
 * Dark hover tooltip (shared by locked status segments and the result "?"
 * button). Pure CSS hover — no positioning library needed.
 */
export function DarkTooltip({ content, align = 'center', wrapperClassName, children }) {
  return (
    <span className={cn('group relative inline-flex', wrapperClassName)}>
      {children}
      <span
        className={cn(
          'pointer-events-none absolute bottom-full z-30 mb-2 w-max max-w-[280px] rounded-[10px] bg-[#1e2130] px-3 py-[7px] text-left text-[12.5px] font-medium leading-relaxed text-white opacity-0 shadow-[0_8px_24px_rgba(20,24,40,.3)] transition-opacity duration-[120ms] group-hover:opacity-100',
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
        outcome === 'placed' ? 'bg-[#e2f5ec] text-[#157a52]' : 'bg-[#fef4e2] text-[#b06a05]'
      )}
    >
      {getRecommendationResultLabel(outcome)}
    </span>
  ) : (
    <span className="inline-flex rounded-full bg-[#f2f3f7] px-3 py-[5px] text-[12.5px] font-semibold text-[#5b6175]">
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
            className="grid h-5 w-5 cursor-help place-items-center rounded-full border border-[#dcdfe9] bg-white text-[11px] font-bold text-[#8b91a5]"
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
          'grid place-items-center rounded-full bg-[#6d5ce6] text-white',
          dim,
          step.state === 'current' && 'shadow-[0_0_0_4px_#e6e2fb]'
        )}
      >
        <Check className={icon} strokeWidth={3} />
      </div>
    );
  }
  return (
    <div
      className={cn(
        'rounded-full bg-white',
        dim,
        step.state === 'skipped'
          ? 'border-2 border-dashed border-[#c3c8d8]'
          : 'border-2 border-solid border-[#d8dce8]'
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
                  connectorActive ? 'bg-[#6d5ce6]' : 'bg-[#d8dce8]'
                )}
                aria-hidden="true"
              />
            )}
            <div className={cn('flex shrink-0 flex-col items-center text-center', column)}>
              <TimelineCircle step={step} size={size} />
              <span
                className={cn(
                  'mt-2 text-[13px] font-semibold',
                  stepIsActive(step) ? 'text-[#33384c]' : 'text-[#9aa1b4]'
                )}
              >
                {step.label}
              </span>
              {step.state === 'skipped' ? (
                <span className="text-[12px] italic text-[#b3b8c8]">Skipped</span>
              ) : step.state === 'pending' ? (
                <span className="text-[12px] text-[#9aa1b4]">Pending</span>
              ) : (
                <span className="text-[12px] text-[#8b91a5]">{step.date}</span>
              )}
              {showCurrentTag && step.state === 'current' && (
                <span className="mt-1.5 inline-flex rounded-full bg-[#eceafc] px-2 py-[3px] text-[10px] font-bold uppercase tracking-wide text-[#5a48d6]">
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
                className={cn(
                  'h-[2px] w-[26px]',
                  connectorActive ? 'bg-[#6d5ce6]' : 'bg-[#d8dce8]'
                )}
                aria-hidden="true"
              />
            )}
            <span
              className={cn(
                'h-3 w-3 rounded-full',
                stepIsActive(step)
                  ? cn('bg-[#6d5ce6]', step.state === 'current' && 'shadow-[0_0_0_3px_#e6e2fb]')
                  : step.state === 'skipped'
                    ? 'border-2 border-dashed border-[#c3c8d8] bg-white'
                    : 'border-2 border-[#d8dce8] bg-white'
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
 * Segmented status control (edit + create modals). Track #f2f3f8, active
 * option violet-filled; locked options are grayed with a padlock and reveal a
 * dark hover tooltip explaining why they can't be selected.
 */
export function StatusSegmented({ statuses, value, onChange, lockedValues = [], lockedHint }) {
  return (
    <div
      className="grid grid-cols-3 gap-1 rounded-xl bg-[#f2f3f8] p-1"
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
                ? 'bg-[#6d5ce6] text-white shadow-[0_2px_8px_rgba(109,92,230,.35)]'
                : locked
                  ? 'cursor-not-allowed text-[#b0b5c6]'
                  : 'text-[#4a5064] hover:text-[#171b2b]'
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
      <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#eef0f5] px-8 pb-5 pt-6">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-3">
            <DialogTitle className={cn('truncate font-bold text-[#171b2b]', titleClassName)}>
              {title}
            </DialogTitle>
            {titleAside}
          </div>
          {subtitle ? (
            <DialogDescription className="mt-1.5 text-[13.5px] text-[#8b91a5]">
              {subtitle}
            </DialogDescription>
          ) : (
            <DialogDescription className="sr-only">{title}</DialogDescription>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-[#f2f3f7] text-[#5b6175] transition hover:bg-[#e7e9ef] hover:text-[#171b2b]"
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
        <div className="flex shrink-0 items-center gap-3 border-t border-[#eef0f5] px-8 py-[18px]">
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
          'flex max-h-[90vh] max-w-[680px] flex-col gap-0 overflow-hidden rounded-[20px] border-0 bg-white p-0 text-[#171b2b] shadow-[0_24px_60px_rgba(20,24,40,.18)] sm:rounded-[20px] sm:p-0',
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
