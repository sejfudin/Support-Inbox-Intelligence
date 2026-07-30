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
      className="relative cursor-pointer rounded-[18px] border border-[#e7e9ef] bg-white shadow-[0_1px_3px_rgba(20,24,40,.06)] transition hover:shadow-[0_4px_14px_rgba(20,24,40,.09)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6d5ce6]"
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
        <div className="flex flex-col border-b border-[#eef0f5] px-7 py-[26px] lg:border-b-0 lg:border-r">
          <h3 className="text-[21px] font-bold leading-tight text-[#171b2b]">{positionName}</h3>
          <div className="mt-5">
            <SectionLabel>Project</SectionLabel>
            <p className="mt-2 flex items-center gap-2 text-[15px] font-semibold text-[#33384c]">
              <span className="h-2 w-2 shrink-0 rounded-[2px] bg-[#6d5ce6]" aria-hidden="true" />
              <span className="[overflow-wrap:anywhere]">
                {recommendation.project?.name || '—'}
              </span>
            </p>
          </div>
          <p className="mt-auto pt-6 text-[12.5px] text-[#8b91a5]">
            {metaLine(recommendation, canWrite)}
          </p>
        </div>

        {/* Right panel */}
        <div className="flex min-w-0 flex-col gap-[22px] pb-6 pl-8 pr-14 pt-[26px]">
          <div className="grid gap-8 xl:grid-cols-[1fr_460px]">
            <div>
              <SectionLabel>Current status</SectionLabel>
              <p className="mt-2.5 flex items-center gap-2.5 text-[16px] font-semibold text-[#171b2b]">
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

          <div className="grid gap-8 border-t border-[#eef0f5] pt-5 xl:grid-cols-[1fr_220px]">
            <div>
              <SectionLabel className="mb-3">Technologies</SectionLabel>
              {technologies.length === 0 ? (
                <span className="text-[13.5px] text-[#8b91a5]">—</span>
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
            </div>
          </div>

          <div className="border-t border-[#eef0f5] pt-5">
            <SectionLabel className="mb-2">Recommendation note</SectionLabel>
            {note ? (
              <div className="flex items-baseline gap-2">
                <span className="min-w-0 truncate text-[13.5px] text-[#5b6175]">{note}</span>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onReadMore();
                  }}
                  className="shrink-0 text-[13.5px] font-semibold text-[#6d5ce6] transition hover:text-[#5a48d6]"
                >
                  Read more
                </button>
              </div>
            ) : (
              <span className="text-[13.5px] text-[#8b91a5]">—</span>
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
      className="relative flex cursor-pointer flex-wrap items-center gap-x-[22px] gap-y-3 rounded-[14px] border border-[#e7e9ef] bg-white py-4 pl-[25px] pr-5 shadow-[0_1px_3px_rgba(20,24,40,.06)] transition hover:shadow-[0_4px_14px_rgba(20,24,40,.09)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6d5ce6]"
      {...cardInteractionProps(onOpen)}
      data-test={`history-card-${recommendation._id}`}
    >
      <span
        className="absolute inset-y-0 left-0 w-[5px] rounded-l-[14px]"
        style={{ background: STATUS_COLORS[recommendation.status] || STATUS_COLORS.recommended }}
        aria-hidden="true"
      />

      <div className="w-[230px] min-w-0 shrink-0">
        <p className="truncate text-[15px] font-bold text-[#171b2b]">{positionName}</p>
        <p className="truncate text-[12.5px] text-[#8b91a5]">
          {recommendation.project?.name || '—'}
        </p>
      </div>

      <MiniTimeline steps={steps} />

      <p className="whitespace-nowrap text-[13px] font-semibold text-[#33384c]">
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
        <span className="whitespace-nowrap text-[12.5px] text-[#8b91a5]">
          {recommendation.updatedBy?.fullname || 'Unknown'}
        </span>
      </div>
    </div>
  );
}
