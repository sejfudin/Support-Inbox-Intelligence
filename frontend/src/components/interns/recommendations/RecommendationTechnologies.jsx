import { ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getAvatarColor } from '@/helpers/avatarColor';
import { getInitials } from '@/helpers/getInitials';
import { TechnologyIcon } from '@/helpers/technologyIcons';
import { cn } from '@/lib/utils';

// One technology reads as an outlined pill with its logo — the same shape the
// recommendation cards use, two sizes down so a row of them fits a 46px table row.
const CHIP =
  'inline-flex items-center gap-1.5 rounded-full border border-separator px-2 py-[3px] text-[11px] font-medium leading-none text-foreground';

function TechnologyChip({ technology, className }) {
  return (
    <span className={cn(CHIP, className)}>
      <TechnologyIcon technology={technology} size={12} className="shrink-0" />
      <span className="truncate">{technology.name}</span>
    </span>
  );
}

/**
 * The Technologies cell. A recommendation can carry ten of them, and ten pills
 * either wrap the row to three lines or get silently cut — so the column shows
 * the first two and collapses the rest into a `+N` pill that opens the full set
 * in a popover.
 *
 * The popover is portalled (Radix), which is what lets it escape the table's
 * horizontal scroll container instead of being clipped by it. It also names the
 * intern in its header: by the time you have scrolled the table sideways to this
 * column, the row you clicked is no longer obvious.
 *
 * @param {{
 *   technologies?: Array<{_id: string, name: string, slug?: string}>,
 *   internName?: string,
 *   subtitle?: string,      // second line beside the count — the position, here
 *   inlineCount?: number,
 * }} props
 */
export default function RecommendationTechnologies({
  technologies = [],
  internName = '',
  subtitle,
  inlineCount = 2,
}) {
  if (technologies.length === 0) {
    return <span className="text-muted-foreground/75">—</span>;
  }

  const inline = technologies.slice(0, inlineCount);
  const hiddenCount = technologies.length - inline.length;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {inline.map((technology) => (
        <TechnologyChip key={technology._id} technology={technology} className="max-w-[130px]" />
      ))}

      {hiddenCount > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              // The row navigates to the intern's profile on click; opening the
              // list of what they know is not a request to leave the page.
              onClick={(event) => event.stopPropagation()}
              className={cn(
                CHIP,
                'gap-1 font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground'
              )}
              aria-label={`Show all ${technologies.length} technologies`}
              data-test="recommendation-technologies-more"
            >
              +{hiddenCount}
              <ChevronDown className="h-3 w-3 shrink-0" aria-hidden="true" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            sideOffset={6}
            className="w-[320px] p-0"
            data-test="recommendation-technologies-popover"
          >
            <div className="flex items-center gap-2.5 border-b border-separator px-3.5 py-3">
              <span
                className={cn(
                  'grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10.5px] font-bold',
                  getAvatarColor(internName)
                )}
                aria-hidden="true"
              >
                {getInitials(internName)}
              </span>
              <div className="min-w-0 leading-[1.35]">
                <p className="truncate text-[12.5px] font-semibold text-foreground">
                  {internName || 'Technologies'}
                </p>
                <p className="truncate text-[11.5px] text-muted-foreground/75">
                  {technologies.length} technologies
                  {subtitle ? ` · ${subtitle}` : ''}
                </p>
              </div>
            </div>
            {/* Capped rather than unbounded: a fifteen-technology recommendation
                would otherwise run the popover past the bottom of the viewport. */}
            <div className="max-h-[240px] overflow-y-auto p-3.5">
              <div className="flex flex-wrap gap-1.5">
                {technologies.map((technology) => (
                  <TechnologyChip key={technology._id} technology={technology} />
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
