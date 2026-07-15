import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/**
 * One reusable modal shell for the intern detail/edit dialogs. It renders a
 * header (title + optional subtitle), a body of labelled sections, and a
 * footer. Read-only detail views and edit forms both compose from the same
 * shell + the presentational blocks exported below.
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {string} props.title
 * @param {string} [props.subtitle]
 * @param {Array<{label?: string, content: import('react').ReactNode}>} props.sections
 * @param {import('react').ReactNode} [props.footer] Custom footer; defaults to a Close button.
 * @param {() => void} [props.onSubmit] When set, the body is wrapped in a <form>.
 * @param {string} [props.dataTest]
 */
export function DetailModal({
  open,
  onClose,
  title,
  subtitle,
  sections = [],
  footer,
  onSubmit,
  dataTest,
  className,
}) {
  const body = (
    <>
      <DialogHeader className="min-w-0">
        <DialogTitle>{title}</DialogTitle>
        {subtitle && <DialogDescription>{subtitle}</DialogDescription>}
      </DialogHeader>

      <div className="min-w-0 space-y-6">
        {sections.map((section, index) => (
          <section key={section.label ?? index} className="min-w-0 space-y-3">
            {section.label && (
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                {section.label}
              </p>
            )}
            {section.content}
          </section>
        ))}
      </div>

      <DialogFooter>
        {footer ?? (
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        )}
      </DialogFooter>
    </>
  );

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        className={cn('max-h-[88vh] max-w-xl overflow-y-auto', className)}
        data-test={dataTest}
      >
        {onSubmit ? (
          <form
            className="space-y-6"
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit();
            }}
          >
            {body}
          </form>
        ) : (
          body
        )}
      </DialogContent>
    </Dialog>
  );
}

// Shared tag/pill tones (mirror HistoryPanel's tag colors) for status chips.
export const TAG_TONE = {
  green: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  indigo: 'bg-primary/10 text-primary',
  slate: 'bg-muted text-muted-foreground',
};

// ---------- presentational blocks (read-only) ----------

/** Big highlighted average-score banner (green ≥4, indigo ≥3, amber below). */
export function ScoreBanner({ label = 'Average score', value }) {
  const tone =
    value >= 4
      ? 'bg-emerald-500/15 ring-1 ring-inset ring-emerald-500/30 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
      : value >= 3
        ? 'bg-primary/15 ring-1 ring-inset ring-primary/30 text-primary'
        : 'bg-amber-500/15 ring-1 ring-inset ring-amber-500/30 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300';
  return (
    <div className={cn('flex items-center justify-between rounded-xl px-4 py-3.5', tone)}>
      <span className="text-[11px] font-bold uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-extrabold tabular-nums">{Number(value).toFixed(1)}/5</span>
    </div>
  );
}

/** 2-column grid of labelled score tiles, each tinted by its score band. */
export function ScoreTiles({ items }) {
  // The whole tile carries the score's color (bg + border + value) so the grid
  // reads as color at a glance; higher = greener, lower = amber.
  const tileTone = (score) =>
    score >= 4.5
      ? 'bg-emerald-500/12 ring-1 ring-inset ring-emerald-500/25 dark:bg-emerald-500/15'
      : score >= 3.5
        ? 'bg-primary/12 ring-1 ring-inset ring-primary/25'
        : 'bg-amber-500/12 ring-1 ring-inset ring-amber-500/25 dark:bg-amber-500/15';
  const valueTone = (score) =>
    score >= 4.5
      ? 'text-emerald-600 dark:text-emerald-400'
      : score >= 3.5
        ? 'text-primary'
        : 'text-amber-600 dark:text-amber-400';
  const labelTone = (score) =>
    score >= 4.5
      ? 'text-emerald-700/80 dark:text-emerald-300/80'
      : score >= 3.5
        ? 'text-primary/80'
        : 'text-amber-700/80 dark:text-amber-300/80';
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div
          key={item.label}
          className={cn(
            'flex items-center justify-between rounded-xl px-4 py-3',
            tileTone(item.score)
          )}
        >
          <span className={cn('text-sm font-medium', labelTone(item.score))}>{item.label}</span>
          <span className="text-base font-extrabold tabular-nums">
            <span className={valueTone(item.score)}>{item.score}</span>
            <span className={cn('text-xs font-bold', labelTone(item.score))}>/5</span>
          </span>
        </div>
      ))}
    </div>
  );
}

/** Wrapped read-only chips (e.g. Shared with / Technologies). */
export function Chips({ items, emptyLabel = '—' }) {
  if (!items || items.length === 0) {
    return <span className="text-sm text-muted-foreground">{emptyLabel}</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, index) => (
        <span
          key={`${item}-${index}`}
          className="rounded-lg bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

/** Read-only long text block that wraps and never overflows. */
export function DetailText({ children }) {
  return (
    <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground [overflow-wrap:anywhere]">
      {children}
    </p>
  );
}
