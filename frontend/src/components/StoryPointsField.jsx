import { BarChart3, Check, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  STORY_POINTS_OPTIONS,
  normalizeStoryPoints,
  getStoryPointsStyle,
} from '@/helpers/storyPoints';

export default function StoryPointsField({
  value,
  onChange,
  disabled = false,
  hideLabel = false,
  className,
}) {
  const currentValue = normalizeStoryPoints(value);
  const currentStyle = getStoryPointsStyle(currentValue);
  const currentLabel = currentValue === null ? 'Not set' : `SP ${currentValue}`;

  return (
    <div className={cn('space-y-3', className)}>
      {/*
        Optional label (kept by default). Some layouts provide a combined label
        for multiple fields (e.g. Priority + Story Points).
      */}
      {hideLabel ? null : (
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            Story Points
          </span>
        </div>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={disabled}>
          <button
            type="button"
            data-test="ticket-story-points-trigger"
            className={cn(
              'flex w-full items-center justify-between gap-2 px-3 py-3 rounded-md text-xs font-bold uppercase transition-colors outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 bg-muted text-foreground hover:bg-muted',
              disabled && 'cursor-not-allowed opacity-60'
            )}
            aria-label={`Change story points (current: ${currentLabel})`}
          >
            <span className="flex items-center gap-2 min-w-0">
              <span className={cn('h-2 w-2 rounded-full', currentStyle.dot)} />
              <span className="min-w-0 truncate">{currentLabel}</span>
            </span>
            <ChevronDown className="w-3.5 h-3.5 opacity-50" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-44 z-[200]">
          <DropdownMenuItem
            onSelect={() => onChange?.(null)}
            className="cursor-pointer"
            data-test="ticket-story-points-option-none"
          >
            <span className="h-2 w-2 rounded-full bg-muted/500 mr-2" />
            <span className="flex-1">No estimate</span>
            {currentValue === null ? <Check className="w-4 h-4 opacity-80 ml-2" /> : null}
          </DropdownMenuItem>

          {STORY_POINTS_OPTIONS.map((option) => {
            const isSelected = currentValue === option.value;
            const style = getStoryPointsStyle(option.value);

            return (
              <DropdownMenuItem
                key={option.value}
                onSelect={() => onChange?.(option.value)}
                className="cursor-pointer"
                data-test={`ticket-story-points-option-${option.value}`}
              >
                <span className={cn('h-2 w-2 rounded-full mr-2', style.dot)} />
                <span className="flex-1">{`SP ${option.label}`}</span>
                {isSelected ? <Check className="w-4 h-4 opacity-80 ml-2" /> : null}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
