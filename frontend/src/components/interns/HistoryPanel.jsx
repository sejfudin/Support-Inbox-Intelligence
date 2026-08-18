import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SortControl } from '@/components/interns/SortControl';
import { CHIP, badgeTone } from '@/helpers/badgeTones';
import { scoreFillClass, scoreTextClass, scoreTrackClass } from '@/helpers/scoreBand';
import { cn } from '@/lib/utils';

const dataTestId = (title) =>
  String(title || 'history')
    .toLowerCase()
    .replace(/\s+/g, '-');

/**
 * @typedef {Object} HistoryCard
 * @property {string} id
 * @property {{label:string,tone:'success'|'primary'|'neutral'}} [tag] e.g. LATEST
 * @property {string} title            the period, beside the tag
 * @property {{value:number,label?:string,hint?:string}} [score] square score badge
 * @property {{initials:string,name:string}} [avatar]
 * @property {string} [metaSub]
 * @property {Array<Object>} blocks    meters | chips | pill (see renderBlock)
 * @property {string} [note]
 * @property {Record<string, string|number>} [sortVals]
 */

const TAG_TONE = {
  success: 'bg-[hsl(var(--tone-success)/0.15)] text-[hsl(var(--tone-success-fg))]',
  primary: 'bg-primary/15 accent-ink',
  neutral: 'bg-muted text-muted-foreground',
};

/**
 * The row's headline number: a square tinted by its own band, the label beside it,
 * and one line of context under that ("of 5 · On track").
 *
 * A square rather than the conic-gradient ring this used to draw: the ring encoded
 * the score twice (arc length and the digits) and cost a 56px circle plus a shadow
 * to do it, which is the "oversized" the overhaul is removing. The tint carries the
 * band; the digits carry the value.
 */
function ScoreBadge({ value, label = 'Overall', hint }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={cn(
          'grid h-12 w-12 shrink-0 place-items-center rounded-[var(--r-tile)] text-[15px] font-bold tabular-nums',
          scoreTrackClass(value),
          scoreTextClass(value)
        )}
      >
        {Number(value).toFixed(1)}
      </span>
      <span className="flex min-w-0 flex-col leading-[1.35]">
        <span className="text-[12.5px] font-semibold text-foreground">{label}</span>
        <span className="truncate text-[11.5px] text-muted-foreground/75">
          of 5{hint ? ` · ${hint}` : ''}
        </span>
      </span>
    </div>
  );
}

function AuthorRow({ initials, name, metaSub }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full bg-primary/15 text-[10.5px] font-bold accent-ink">
        {initials}
      </span>
      <div className="min-w-0 leading-[1.35]">
        <p className="truncate text-[12.5px] text-foreground">{name}</p>
        {metaSub && <p className="truncate text-[11px] text-muted-foreground/75">{metaSub}</p>}
      </div>
    </div>
  );
}

function renderBlock(block, index) {
  if (block.kind === 'meters') {
    return (
      <div key={index} className="grid gap-x-5 gap-y-2.5 sm:grid-cols-2">
        {block.items.map((item) => {
          const pct = Math.max(0, Math.min(1, item.score / 5)) * 100;
          return (
            <div key={item.label}>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[12.5px] text-muted-foreground">{item.label}</span>
                <span className="shrink-0 text-[12.5px] font-semibold tabular-nums text-foreground">
                  {item.score}/5
                </span>
              </div>
              <div
                className={cn(
                  'mt-1.5 h-[5px] overflow-hidden rounded-full',
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
    return (
      <div key={index}>
        <p className="app-crumb mb-1.5">{block.label}</p>
        <div className="flex flex-wrap gap-1.5">
          {block.items.length === 0 && (
            // Italic prose rather than a bare dash: a dash in a list of chips reads
            // as a chip whose label failed to load.
            <span className="text-[12px] italic text-muted-foreground/75">None recorded.</span>
          )}
          {block.items.map((chip, i) => (
            <span
              key={`${chip}-${i}`}
              className="rounded-full border border-separator px-[11px] py-[5px] text-[12px] font-medium text-foreground"
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
        <p className="app-crumb mb-1.5">{block.label}</p>
        <span className={cn(CHIP, badgeTone(block.tone))}>{block.value}</span>
      </div>
    );
  }

  return null;
}

function HistoryRow({ card, onReadMore, onCardClick }) {
  const interactive = Boolean(onCardClick);

  return (
    <div
      className={cn(
        'grid gap-x-5 gap-y-3 border-b border-separator px-[18px] py-3 last:border-b-0 lg:grid-cols-[280px_minmax(0,1fr)]',
        interactive &&
          'cursor-pointer transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring'
      )}
      onClick={interactive ? () => onCardClick(card) : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
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
      <div className="flex min-w-0 flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {card.tag && (
            <span
              className={cn(
                CHIP,
                'text-[10px] uppercase tracking-[0.06em]',
                TAG_TONE[card.tag.tone] || TAG_TONE.neutral
              )}
            >
              {card.tag.label}
            </span>
          )}
          <span className="text-[12.5px] text-muted-foreground">{card.title}</span>
        </div>

        {card.score && (
          <ScoreBadge value={card.score.value} label={card.score.label} hint={card.score.hint} />
        )}

        {card.avatar && (
          <AuthorRow
            initials={card.avatar.initials}
            name={card.avatar.name}
            metaSub={card.metaSub}
          />
        )}
        {!card.avatar && card.metaSub && (
          <p className="text-[11.5px] text-muted-foreground/75">{card.metaSub}</p>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        {(card.blocks || []).map((block, index) => renderBlock(block, index))}

        {card.note && (
          <div className="border-t border-separator pt-2.5">
            <p className="text-[12.5px] leading-[1.5] text-foreground/90">
              <span className="line-clamp-2 align-top [overflow-wrap:anywhere]">{card.note}</span>
              {onReadMore && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onReadMore(card.id);
                  }}
                  className="mt-0.5 font-semibold accent-ink hover:underline"
                >
                  Read more
                </button>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Reusable, data-driven history list: one card with a header (title/subtitle +
 * sort + create button) and rows separated by hairlines. All visual logic (score
 * bands, meter widths, chip shapes) lives here; sections differ only by config.
 * Each consuming panel owns its own create/edit + detail dialogs and drives them
 * via onNew / onCardClick / onReadMore.
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

  // A given sort key is numeric (dates/scores) or text (names/labels). Numeric
  // fields default to descending (newest/highest first); text fields default to
  // ascending (A→Z). This keeps the direction meaning consistent across
  // sections instead of "desc" meaning newest-first for dates but Z→A for names.
  const isNumericKey = (key) => cards.some((card) => typeof card.sortVals?.[key] === 'number');

  const handleSortKeyChange = (key) => {
    setSortKey(key);
    if (key) setSortDir(isNumericKey(key) ? 'desc' : 'asc');
  };

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
    <section className="app-card overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-separator px-[18px] py-3">
        <div className="min-w-0">
          <h2 className="app-card-title">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[12.5px] text-muted-foreground">{subtitle}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {sortOptions.length > 0 && (
            <SortControl
              sortKey={sortKey}
              sortDir={sortDir}
              options={sortOptions}
              onSortKeyChange={handleSortKeyChange}
              onToggleDir={() => setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
              className="h-8 rounded-[var(--r-control)]"
              triggerClassName="text-[12.5px]"
              dataTest={`${dataTestId(title)}-sort`}
            />
          )}
          {canWrite && (
            <Button
              type="button"
              onClick={onNew}
              className="px-3 text-[12.5px]"
              data-test={`${dataTestId(title)}-new-button`}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              {buttonLabel}
            </Button>
          )}
        </div>
      </header>

      <div>
        {isLoading && (
          <p className="px-[18px] py-8 text-center text-[12.5px] text-muted-foreground">Loading…</p>
        )}
        {!isLoading && sortedCards.length === 0 && (
          <p className="px-[18px] py-10 text-center text-[12.5px] text-muted-foreground">
            {emptyMessage}
          </p>
        )}
        {!isLoading &&
          sortedCards.map((card) => (
            <HistoryRow
              key={card.id}
              card={card}
              onReadMore={onReadMore}
              onCardClick={onCardClick}
            />
          ))}
      </div>
    </section>
  );
}
