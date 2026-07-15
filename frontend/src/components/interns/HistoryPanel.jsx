import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { InternPanel } from '@/components/interns/InternPanel';
import { cn } from '@/lib/utils';

/**
 * @typedef {Object} HistoryCard
 * @property {string} id
 * @property {boolean} [featured] Latest item — indigo-tinted card.
 * @property {{label:string,color:'green'|'indigo'|'slate'}} [tag]
 * @property {string} title
 * @property {{value:number,label?:string,trend?:{kind:'up'|'flat',delta?:number}}} [ring]
 * @property {{initials:string,name:string}} [avatar]
 * @property {string} [metaSub]
 * @property {Array<Object>} blocks  bars | chips | pill blocks (see renderBlock)
 * @property {string} [note]
 * @property {Record<string, string|number>} [sortVals]
 */

// ---- color maps (theme-aware: primary token for indigo, muted for neutral,
// and the same emerald/amber/red tints the app's Badge uses for semantics) ----
const TAG_COLORS = {
  green: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  indigo: 'bg-primary/10 text-primary',
  slate: 'bg-muted text-muted-foreground',
};

const PILL_COLORS = {
  green: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  indigo: 'bg-primary/10 text-primary',
  amber: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  red: 'bg-red-500/15 text-red-700 dark:text-red-300',
  slate: 'bg-muted text-muted-foreground',
};

// Ring fill uses the theme primary (indigo) or emerald; the empty track uses
// the muted token so it adapts to light/dark.
const ringFill = (value) => (value >= 4 ? 'hsl(160 84% 39%)' : 'hsl(var(--primary))');
const barColor = (score) =>
  score >= 5 ? 'bg-emerald-500' : score >= 4 ? 'bg-primary' : 'bg-amber-500';

function Ring({ value, label = 'Overall', trend }) {
  const pct = Math.max(0, Math.min(1, value / 5)) * 100;
  return (
    <div className="flex items-center gap-3">
      <div
        className="grid h-14 w-14 place-items-center rounded-full"
        style={{ background: `conic-gradient(${ringFill(value)} ${pct}%, hsl(var(--muted)) 0)` }}
      >
        <div className="grid h-11 w-11 place-items-center rounded-full bg-card text-sm font-bold text-foreground">
          {Number(value).toFixed(1)}
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        {trend?.kind === 'up' ? (
          <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            ▲ +{Number(trend.delta ?? 0).toFixed(1)}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">baseline</p>
        )}
      </div>
    </div>
  );
}

function Avatar({ initials, name, metaSub }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
        {initials}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm text-muted-foreground">{name}</p>
        {metaSub && <p className="truncate text-xs text-muted-foreground/80">{metaSub}</p>}
      </div>
    </div>
  );
}

function renderBlock(block, index) {
  if (block.kind === 'bars') {
    return (
      <div key={index} className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
        {block.items.map((item) => {
          const pct = Math.max(0, Math.min(1, item.score / 5)) * 100;
          return (
            <div key={item.label}>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{item.label}</span>
                <span className="text-sm font-bold text-foreground">{item.score}/5</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn('h-full rounded-full', barColor(item.score))}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (block.kind === 'chips') {
    return (
      <div key={index}>
        <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">
          {block.label}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {block.items.length === 0 && <span className="text-sm text-muted-foreground">—</span>}
          {block.items.map((chip, i) => (
            <span
              key={`${chip}-${i}`}
              className="rounded-lg bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground"
            >
              {chip}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (block.kind === 'pill') {
    return (
      <div key={index}>
        <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">
          {block.label}
        </p>
        <span
          className={cn(
            'inline-flex rounded-md px-2 py-1 text-xs font-semibold',
            PILL_COLORS[block.color] || PILL_COLORS.slate
          )}
        >
          {block.value}
        </span>
      </div>
    );
  }

  return null;
}

function HistoryCardView({ card, onReadMore, onCardClick }) {
  return (
    <div
      className={cn(
        'rounded-[18px] p-5 transition sm:p-6',
        onCardClick && 'cursor-pointer hover:shadow-lg',
        card.featured
          ? 'border border-primary/20 bg-primary/5 shadow-md shadow-primary/10'
          : 'border border-border bg-card'
      )}
      onClick={onCardClick ? () => onCardClick(card) : undefined}
      data-test={`history-card-${card.id}`}
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:gap-0 sm:divide-x sm:divide-border">
        {/* Left column */}
        <div className="flex shrink-0 flex-col gap-3.5 sm:w-52 sm:pr-6">
          {card.tag && (
            <span
              className={cn(
                'inline-flex w-fit rounded-md px-2 py-1 text-[10.5px] font-bold uppercase tracking-wide',
                TAG_COLORS[card.tag.color] || TAG_COLORS.slate
              )}
            >
              {card.tag.label}
            </span>
          )}
          <p className="text-base font-bold text-foreground">{card.title}</p>
          {card.ring && (
            <Ring value={card.ring.value} label={card.ring.label} trend={card.ring.trend} />
          )}
          {card.avatar && (
            <Avatar
              initials={card.avatar.initials}
              name={card.avatar.name}
              metaSub={card.metaSub}
            />
          )}
          {!card.avatar && card.metaSub && (
            <p className="text-xs text-muted-foreground">{card.metaSub}</p>
          )}
        </div>

        {/* Right column */}
        <div className="flex min-w-0 flex-1 flex-col gap-4 sm:pl-7">
          {(card.blocks || []).map((block, index) => renderBlock(block, index))}

          {card.note && (
            <div className="mt-1 border-t border-border pt-3.5">
              <p className="text-sm leading-relaxed text-muted-foreground">
                <span className="line-clamp-2 align-top [overflow-wrap:anywhere]">{card.note}</span>
                {onReadMore && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onReadMore(card.id);
                    }}
                    className="mt-1 font-semibold text-primary hover:text-primary/80"
                  >
                    Read more
                  </button>
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- create/edit modal ----
function FieldInput({ field, value, onChange }) {
  const base =
    'w-full rounded-xl border border-input bg-muted/40 px-3 py-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30';

  if (field.type === 'textarea') {
    return (
      <textarea
        rows={field.rows || 4}
        value={value ?? ''}
        placeholder={field.placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={cn(base, 'resize-y')}
      />
    );
  }
  if (field.type === 'score') {
    return (
      <select
        value={value ?? ''}
        onChange={(event) => onChange(Number(event.target.value))}
        className={base}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <option key={n} value={n}>
            {n}/5
          </option>
        ))}
      </select>
    );
  }
  if (field.type === 'select') {
    return (
      <select
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        className={base}
      >
        {(field.options || []).map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      type="text"
      value={value ?? ''}
      placeholder={field.placeholder}
      onChange={(event) => onChange(event.target.value)}
      className={base}
    />
  );
}

/**
 * Reusable, data-driven history panel: header (title/subtitle + sort + create
 * button), a vertical list of cards, and a create/edit modal. All visual logic
 * (colors, ring %, bar thresholds) lives here; sections differ only by config.
 */
export function HistoryPanel({
  title,
  subtitle,
  buttonLabel = 'New',
  modalTitle,
  cards = [],
  sortOptions = [],
  modalFields = [],
  canWrite = true,
  isLoading = false,
  emptyMessage = 'Nothing recorded yet.',
  onCreate,
  onNew,
  onReadMore,
  onCardClick,
}) {
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState('desc');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({});

  const sortedCards = useMemo(() => {
    if (!sortKey) return cards;
    const factor = sortDir === 'asc' ? 1 : -1;
    return [...cards].sort((a, b) => {
      const av = a.sortVals?.[sortKey];
      const bv = b.sortVals?.[sortKey];
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * factor;
      return String(av ?? '').localeCompare(String(bv ?? '')) * factor;
    });
  }, [cards, sortKey, sortDir]);

  // When a panel supplies its own create form via onNew, defer to it. Otherwise
  // use the built-in generic modal driven by modalFields.
  const useBuiltInModal = modalFields.length > 0 && !onNew;

  const handleNew = () => {
    if (onNew) {
      onNew();
      return;
    }
    const initial = {};
    modalFields.forEach((field) => {
      initial[field.name] = field.type === 'score' ? (field.default ?? 3) : (field.default ?? '');
    });
    setForm(initial);
    setModalOpen(true);
  };

  const handleSave = (event) => {
    event.preventDefault();
    Promise.resolve(onCreate?.(form)).then((ok) => {
      // onCreate may return false to keep the modal open (validation failed).
      if (ok !== false) setModalOpen(false);
    });
  };

  return (
    <InternPanel className="p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-foreground">{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {sortOptions.length > 0 && (
            <>
              <select
                value={sortKey}
                onChange={(event) => setSortKey(event.target.value)}
                className="rounded-xl border border-input bg-background px-3 py-2 text-sm text-muted-foreground outline-none focus:border-ring"
                data-test={`${dataTestId(title)}-sort`}
              >
                <option value="">Default</option>
                {sortOptions.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!sortKey}
                onClick={() => setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                className="grid h-9 w-9 place-items-center rounded-xl border border-input bg-background text-muted-foreground transition hover:bg-accent disabled:opacity-40"
                aria-label="Toggle sort direction"
              >
                {sortDir === 'asc' ? (
                  <ArrowUp className="h-4 w-4" />
                ) : (
                  <ArrowDown className="h-4 w-4" />
                )}
              </button>
            </>
          )}
          {canWrite && (
            <button
              type="button"
              onClick={handleNew}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition hover:bg-primary/90"
              data-test={`${dataTestId(title)}-new-button`}
            >
              <Plus className="h-4 w-4" />
              {buttonLabel}
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && sortedCards.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">{emptyMessage}</p>
        )}
        {!isLoading &&
          sortedCards.map((card) => (
            <HistoryCardView
              key={card.id}
              card={card}
              onReadMore={onReadMore}
              onCardClick={onCardClick}
            />
          ))}
      </div>

      {useBuiltInModal && (
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{modalTitle || buttonLabel}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave}>
              <div className="grid grid-cols-2 gap-4">
                {modalFields.map((field) => (
                  <div key={field.name} className={cn('space-y-1.5', field.full && 'col-span-2')}>
                    <label className="text-sm font-medium text-foreground">{field.label}</label>
                    <FieldInput
                      field={field}
                      value={form[field.name]}
                      onChange={(value) => setForm((prev) => ({ ...prev, [field.name]: value }))}
                    />
                  </div>
                ))}
              </div>
              <DialogFooter className="mt-6">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-input bg-background px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition hover:bg-primary/90"
                >
                  Save
                </button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </InternPanel>
  );
}

const dataTestId = (title) =>
  String(title || 'history')
    .toLowerCase()
    .replace(/\s+/g, '-');
