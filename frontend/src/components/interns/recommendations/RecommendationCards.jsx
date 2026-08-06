import { cn } from '@/lib/utils';
import { getRecommendationStatusLabel } from '@/helpers/recommendations';
import { TechnologyIcon } from '@/helpers/technologyIcons';
import {
  CHIP_CLASS,
  MiniTimeline,
  RecommendationTimeline,
  ResultChip,
  SectionLabel,
  STATUS_COLORS,
  formatRecDate,
} from './recommendationUi';

const cardInteractionProps = (onOpen) => ({
  role: 'button',
  tabIndex: 0,
  onClick: onOpen,
  onKeyDown: (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen();
    }
  },
});

const metaLine = (recommendation, canWrite) =>
  `Updated ${formatRecDate(recommendation.updatedAt)} · ${
    recommendation.updatedBy?.fullname || 'Unknown'
  }${canWrite ? '' : ' · view only'}`;

/**
 * Detailed recommendation card: 5px status-color left strip, 290px left panel
 * (position / project / meta) and a right panel with current status +
 * timeline, technologies + result, and the recommendation note.
 */
export function RecommendationCard({
  recommendation,
  steps,
  positionName,
  canWrite,
  onOpen,
  onReadMore,
}) {
  const technologies = recommendation.technologies || [];
  const note = recommendation.recommendationNote;

  return (
    <div
      className="relative cursor-pointer rounded-[18px] border border-border bg-card shadow-elevated-sm transition hover:shadow-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      {...cardInteractionProps(onOpen)}
      data-test={`history-card-${recommendation._id}`}
    >
      <span
        className="absolute inset-y-0 left-0 w-[5px] rounded-l-[18px]"
        style={{ background: STATUS_COLORS[recommendation.status] || STATUS_COLORS.recommended }}
        aria-hidden="true"
      />

      <div className="grid lg:grid-cols-[290px_1fr]">
        {/* Left panel */}
        <div className="flex flex-col border-b border-border/60 px-7 py-[26px] lg:border-b-0 lg:border-r">
          <h3 className="text-[21px] font-bold leading-tight text-foreground">{positionName}</h3>
          <div className="mt-5">
            <SectionLabel>Project</SectionLabel>
            <p className="mt-2 flex items-center gap-2 text-[15px] font-semibold text-foreground/90">
              <span className="h-2 w-2 shrink-0 rounded-[2px] bg-primary" aria-hidden="true" />
              <span className="[overflow-wrap:anywhere]">
                {recommendation.project?.name || '—'}
              </span>
            </p>
          </div>
          <p className="mt-auto pt-6 text-[12.5px] text-muted-foreground">
            {metaLine(recommendation, canWrite)}
          </p>
        </div>

        {/* Right panel */}
        <div className="flex min-w-0 flex-col gap-[22px] pb-6 pl-8 pr-14 pt-[26px]">
          <div className="grid gap-8 xl:grid-cols-[1fr_460px]">
            <div>
              <SectionLabel>Current status</SectionLabel>
              <p className="mt-2.5 flex items-center gap-2.5 text-[16px] font-semibold text-foreground">
                <span
                  className="h-[9px] w-[9px] shrink-0 rounded-full"
                  style={{
                    background: STATUS_COLORS[recommendation.status] || STATUS_COLORS.recommended,
                  }}
                  aria-hidden="true"
                />
                {getRecommendationStatusLabel(recommendation.status)} ·{' '}
                {formatRecDate(
                  (recommendation.statusDates || {})[recommendation.status] ||
                    recommendation.updatedAt
                )}
              </p>
            </div>
            <div className="min-w-0">
              <SectionLabel className="mb-3">Status timeline</SectionLabel>
              <RecommendationTimeline steps={steps} size="card" />
            </div>
          </div>

          <div className="grid gap-8 border-t border-border/60 pt-5 xl:grid-cols-[1fr_220px]">
            <div>
              <SectionLabel className="mb-3">Technologies</SectionLabel>
              {technologies.length === 0 ? (
                <span className="text-[13.5px] text-muted-foreground">—</span>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {technologies.map((technology) => (
                    <span key={technology._id} className={cn(CHIP_CLASS, 'gap-1.5')}>
                      <TechnologyIcon technology={technology} size={13} className="shrink-0" />
                      {technology.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div>
              <SectionLabel className="mb-3">Result</SectionLabel>
              <ResultChip result={recommendation.result} />
              {/* Only on the detailed card — the compact row is a single line and
                  already carries the chip, timeline and author. */}
              {recommendation.result?.outcome === 'placed' && (
                <p className="mt-2 text-[12.5px] text-muted-foreground">
                  {recommendation.result.startDate
                    ? `Starts ${formatRecDate(recommendation.result.startDate)}`
                    : 'Start date not set'}
                </p>
              )}
            </div>
          </div>

          <div className="border-t border-border/60 pt-5">
            <SectionLabel className="mb-2">Recommendation note</SectionLabel>
            {note ? (
              <div className="flex items-baseline gap-2">
                <span className="min-w-0 truncate text-[13.5px] text-muted-foreground">{note}</span>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onReadMore();
                  }}
                  className="shrink-0 text-[13.5px] font-semibold text-primary transition hover:text-primary/80"
                >
                  Read more
                </button>
              </div>
            ) : (
              <span className="text-[13.5px] text-muted-foreground">—</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact recommendation row (view switcher = Compact): status strip, position
 * + project, mini dot timeline, current status, technology count, result chip
 * and author.
 */
export function RecommendationCompactRow({ recommendation, steps, positionName, onOpen }) {
  const technologyCount = (recommendation.technologies || []).length;

  return (
    <div
      className="relative flex cursor-pointer flex-wrap items-center gap-x-[22px] gap-y-3 rounded-[14px] border border-border bg-card py-4 pl-[25px] pr-5 shadow-elevated-sm transition hover:shadow-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      {...cardInteractionProps(onOpen)}
      data-test={`history-card-${recommendation._id}`}
    >
      <span
        className="absolute inset-y-0 left-0 w-[5px] rounded-l-[14px]"
        style={{ background: STATUS_COLORS[recommendation.status] || STATUS_COLORS.recommended }}
        aria-hidden="true"
      />

      <div className="w-[230px] min-w-0 shrink-0">
        <p className="truncate text-[15px] font-bold text-foreground">{positionName}</p>
        <p className="truncate text-[12.5px] text-muted-foreground">
          {recommendation.project?.name || '—'}
        </p>
      </div>

      <MiniTimeline steps={steps} />

      <p className="whitespace-nowrap text-[13px] font-semibold text-foreground/90">
        {getRecommendationStatusLabel(recommendation.status)} ·{' '}
        {formatRecDate(
          (recommendation.statusDates || {})[recommendation.status] || recommendation.updatedAt
        )}
      </p>

      <span className={cn(CHIP_CLASS, 'text-[12px]')}>
        {technologyCount} {technologyCount === 1 ? 'technology' : 'technologies'}
      </span>

      <div className="ml-auto flex items-center gap-4">
        <ResultChip result={recommendation.result} />
        <span className="whitespace-nowrap text-[12.5px] text-muted-foreground">
          {recommendation.updatedBy?.fullname || 'Unknown'}
        </span>
      </div>
    </div>
  );
}
