import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Plus } from 'lucide-react';
import { InternPanel } from '@/components/interns/InternPanel';
import { StatusTimeline } from '@/components/interns/StatusTimeline';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  scoreFillClass,
  scoreFillHsl,
  scoreTextClass,
  scoreTrackClass,
  scoreTrackHsl,
} from '@/helpers/scoreBand';
import { cn } from '@/lib/utils';

// Radix Select forbids an empty-string item value, so the "Default" (no sort)
// option uses this sentinel while the component still tracks sortKey as ''.
const SORT_DEFAULT = 'default';

const dataTestId = (title) =>
  String(title || 'history')
    .toLowerCase()
    .replace(/\s+/g, '-');

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

// Responsive column classes for `blockRows` grids. Full literal strings so
// Tailwind's JIT compiler keeps them. Single column on mobile, N across at sm+.
const ROW_GRID_COLS = {
  1: 'sm:grid-cols-1',
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
};

// ---- color maps (theme-aware: primary token for indigo, muted for neutral,
// and the same emerald/amber/red tints the app's Badge uses for semantics) ----
const TAG_COLORS = {
  green: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
  indigo: 'bg-primary/20 text-primary',
  slate: 'bg-muted text-muted-foreground',
};

const PILL_COLORS = {
  green: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
  indigo: 'bg-primary/20 text-primary',
  amber: 'bg-amber-500/20 text-amber-700 dark:text-amber-300',
  red: 'bg-red-500/20 text-red-700 dark:text-red-300',
  slate: 'bg-muted text-muted-foreground',
};

function Ring({ value, label = 'Overall', trend }) {
  const pct = Math.max(0, Math.min(1, value / 5)) * 100;
  const fill = scoreFillHsl(value);
  const track = scoreTrackHsl(value);
  return (
    <div className="flex items-center gap-3">
      <div
        className="grid h-14 w-14 place-items-center rounded-full"
        style={{
          background: `conic-gradient(${fill} ${pct}%, ${track} 0)`,
          boxShadow: `0 0 0 1px ${track}, 0 6px 16px -6px ${fill}`,
        }}
      >
        <div className="grid h-11 w-11 place-items-center rounded-full bg-card text-sm font-extrabold text-foreground">
          {Number(value).toFixed(1)}
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        {trend?.kind === 'up' && (
          <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            ▲ +{Number(trend.delta ?? 0).toFixed(1)}
          </p>
        )}
        {trend?.kind === 'down' && (
          <p className="text-sm font-semibold text-amber-600 dark:text-amber-500">
            ▼ {Number(trend.delta ?? 0).toFixed(1)}
          </p>
        )}
        {(!trend || trend.kind === 'flat') && (
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
                <span className="text-sm font-bold tabular-nums">
                  <span className={scoreTextClass(item.score)}>{item.score}</span>
                  <span className="text-muted-foreground">/5</span>
                </span>
              </div>
              <div
                className={cn(
                  'mt-1.5 h-2.5 overflow-hidden rounded-full',
                  scoreTrackClass(item.score)
                )}
              >
                <div
                  className={cn('h-full rounded-full', scoreFillClass(item.score))}
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
    // Each item is either a plain string or `{ label, icon }` (icon is a React
    // node rendered before the label — e.g. a technology brand logo).
    return (
      <div key={index}>
        <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">
          {block.label}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {block.items.length === 0 && <span className="text-sm text-muted-foreground">—</span>}
          {block.items.map((chip, i) => {
            const label = typeof chip === 'string' ? chip : chip.label;
            const icon = typeof chip === 'string' ? null : chip.icon;
            return (
              <span
                key={`${label}-${i}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground"
              >
                {icon}
                {label}
              </span>
            );
          })}
        </div>
      </div>
    );
  }

  if (block.kind === 'text') {
    // Optional leading status dot: pass `block.dot` as a Tailwind bg-* class
    // (e.g. 'bg-primary'). `block.bold` renders the value in semibold.
    return (
      <div key={index}>
        <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">
          {block.label}
        </p>
        <p
          className={cn(
            'flex items-center gap-2 text-sm text-foreground [overflow-wrap:anywhere]',
            block.bold && 'font-semibold'
          )}
        >
          {block.dot && (
            <span
              className={cn('h-2.5 w-2.5 shrink-0 rounded-full', block.dot)}
              aria-hidden="true"
            />
          )}
          {block.value || '—'}
        </p>
      </div>
    );
  }

  if (block.kind === 'timeline') {
    // Circles-and-lines status stepper (shared with the detail modal).
    return (
      <div key={index}>
        <p className="mb-2 text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">
          {block.label}
        </p>
        <StatusTimeline steps={block.items} size="sm" />
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
        onCardClick &&
          'cursor-pointer hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        card.featured
          ? 'border border-primary/30 bg-primary/[0.07] shadow-lg shadow-primary/15'
          : 'border border-border bg-card'
      )}
      onClick={onCardClick ? () => onCardClick(card) : undefined}
      role={onCardClick ? 'button' : undefined}
      tabIndex={onCardClick ? 0 : undefined}
      onKeyDown={
        onCardClick
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onCardClick(card);
              }
            }
          : undefined
      }
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

        {/* Right column. A card can either provide a flat `blocks` list (stacked
            vertically) or `blockRows` (array of rows) that render as responsive
            grids — one column per block on desktop, collapsing to a single
            column on narrow screens. */}
        <div className="flex min-w-0 flex-1 flex-col gap-5 sm:pl-7">
          {card.blockRows
            ? card.blockRows.map((row, rowIndex) => (
                <div
                  key={rowIndex}
                  className={cn(
                    'grid grid-cols-1 gap-x-8 gap-y-5',
                    ROW_GRID_COLS[row.length] || ''
                  )}
                >
                  {row.map((block, index) => renderBlock(block, `${rowIndex}-${index}`))}
                </div>
              ))
            : (card.blocks || []).map((block, index) => renderBlock(block, index))}

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

/**
 * Reusable, data-driven history panel: header (title/subtitle + sort + create
 * button) and a vertical list of cards. All visual logic (colors, ring %, bar
 * thresholds) lives here; sections differ only by config. Each consuming panel
 * owns its own create/edit + detail dialogs and drives them via onNew /
 * onCardClick / onReadMore.
 */
export function HistoryPanel({
  title,
  subtitle,
  buttonLabel = 'New',
  cards = [],
  sortOptions = [],
  canWrite = true,
  isLoading = false,
  emptyMessage = 'Nothing recorded yet.',
  onNew,
  onReadMore,
  onCardClick,
}) {
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState('desc');

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

  return (
    <InternPanel className="p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-foreground">{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {sortOptions.length > 0 && (
            <div className="flex h-10 items-center rounded-xl border border-input bg-background transition focus-within:border-ring">
              <ArrowUpDown className="ml-3 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <Select
                value={sortKey || SORT_DEFAULT}
                onValueChange={(value) => setSortKey(value === SORT_DEFAULT ? '' : value)}
              >
                <SelectTrigger
                  className="h-10 border-0 bg-transparent px-2 text-sm font-medium shadow-none focus:ring-0 focus:ring-offset-0"
                  data-test={`${dataTestId(title)}-sort`}
                  aria-label="Sort by"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value={SORT_DEFAULT}>Sort: Default</SelectItem>
                  {sortOptions.map((opt) => (
                    <SelectItem key={opt.key} value={opt.key}>
                      Sort: {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                type="button"
                disabled={!sortKey}
                onClick={() => setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                className="grid h-10 w-9 place-items-center border-l border-input text-muted-foreground transition hover:text-foreground disabled:opacity-40 disabled:hover:text-muted-foreground"
                aria-label={`Sort direction: ${sortDir === 'asc' ? 'ascending' : 'descending'}`}
                title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
              >
                {sortDir === 'asc' ? (
                  <ArrowUp className="h-4 w-4" />
                ) : (
                  <ArrowDown className="h-4 w-4" />
                )}
              </button>
            </div>
          )}
          {canWrite && (
            <button
              type="button"
              onClick={onNew}
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
    </InternPanel>
  );
}
