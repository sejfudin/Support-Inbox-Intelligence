import { cn } from '@/lib/utils';
import { getRecommendationStatusLabel } from '@/helpers/recommendations';
import { TechnologyIcon } from '@/helpers/technologyIcons';
import {
  MiniTimeline,
  RecommendationStepper,
  ResultChip,
  StatusPill,
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
 * Detailed recommendation row: position / project / author on the left with the
 * status and result chips, and on the right the three-step stepper, the
 * technologies, and the note under a hairline.
 *
 * A row separated by a hairline rather than a shadowed card with a coloured
 * strip: three attempts stacked as cards was three headings and three shadows to
 * scroll past, and the status the strip encoded is already the stepper's job.
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
      className="grid cursor-pointer gap-x-5 gap-y-3 border-b border-separator px-[18px] py-3 transition-colors last:border-b-0 hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring lg:grid-cols-[250px_minmax(0,1fr)]"
      {...cardInteractionProps(onOpen)}
      data-test={`history-card-${recommendation._id}`}
    >
      {/* Left rail */}
      <div className="flex min-w-0 flex-col gap-1.5">
        <h3 className="text-[13px] font-semibold leading-tight text-foreground">{positionName}</h3>
        <p className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
          <span
            className="h-[7px] w-[7px] shrink-0 rounded-full"
            style={{
              background: STATUS_COLORS[recommendation.status] || STATUS_COLORS.recommended,
            }}
            aria-hidden="true"
          />
          <span className="[overflow-wrap:anywhere]">{recommendation.project?.name || '—'}</span>
        </p>
        <p className="text-[11.5px] leading-[1.4] text-muted-foreground/75">
          {metaLine(recommendation, canWrite)}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          <StatusPill status={recommendation.status} />
          <ResultChip result={recommendation.result} />
        </div>
        {recommendation.result?.outcome === 'placed' && (
          <p className="text-[11.5px] text-muted-foreground/75">
            {recommendation.result.startDate
              ? `Starts ${formatRecDate(recommendation.result.startDate)}`
              : 'Start date not set'}
          </p>
        )}
      </div>

      {/* Right */}
      <div className="flex min-w-0 flex-col gap-3">
        <RecommendationStepper steps={steps} />

        <div>
          <p className="app-crumb mb-1.5">Technologies</p>
          {technologies.length === 0 ? (
            <span className="text-[12px] italic text-muted-foreground/75">None recorded.</span>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {technologies.map((technology) => (
                <span
                  key={technology._id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-separator px-[11px] py-[5px] text-[12px] font-medium text-foreground"
                >
                  <TechnologyIcon technology={technology} size={12} className="shrink-0" />
                  {technology.name}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-separator pt-2.5">
          <p className="app-crumb mb-1">Note</p>
          {note ? (
            <p className="text-[12.5px] leading-[1.5] text-foreground/90">
              <span className="line-clamp-2 align-top [overflow-wrap:anywhere]">{note}</span>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onReadMore();
                }}
                className="mt-0.5 font-semibold accent-ink hover:underline"
              >
                Read more
              </button>
            </p>
          ) : (
            // Italic prose, not a dash — a dash under a "NOTE" heading reads as a
            // value that failed to load rather than as "nobody wrote one".
            <p className="text-[12.5px] italic text-muted-foreground/75">No note recorded.</p>
          )}
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
      className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-2 border-b border-separator px-[18px] py-2.5 transition-colors last:border-b-0 hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      {...cardInteractionProps(onOpen)}
      data-test={`history-card-${recommendation._id}`}
    >
      <div className="w-[210px] min-w-0 shrink-0 leading-[1.35]">
        <p className="truncate text-[12.5px] font-semibold text-foreground">{positionName}</p>
        <p className="flex items-center gap-1.5 truncate text-[11.5px] text-muted-foreground/75">
          <span
            className="h-[6px] w-[6px] shrink-0 rounded-full"
            style={{
              background: STATUS_COLORS[recommendation.status] || STATUS_COLORS.recommended,
            }}
            aria-hidden="true"
          />
          {recommendation.project?.name || '—'}
        </p>
      </div>

      <MiniTimeline steps={steps} />

      <p className="whitespace-nowrap text-[12.5px] text-muted-foreground">
        {getRecommendationStatusLabel(recommendation.status)} ·{' '}
        {formatRecDate(
          (recommendation.statusDates || {})[recommendation.status] || recommendation.updatedAt
        )}
      </p>

      <span className="inline-flex items-center rounded-full border border-separator px-[11px] py-[5px] text-[12px] font-medium text-foreground">
        {technologyCount} {technologyCount === 1 ? 'technology' : 'technologies'}
      </span>

      <div className="ml-auto flex items-center gap-3">
        <ResultChip result={recommendation.result} />
        <span className="whitespace-nowrap text-[11.5px] text-muted-foreground/75">
          {recommendation.updatedBy?.fullname || 'Unknown'}
        </span>
      </div>
    </div>
  );
}
