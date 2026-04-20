import { BarChart3, Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { STORY_POINTS_OPTIONS, normalizeStoryPoints, getStoryPointsStyle } from "@/helpers/storyPoints";


export default function StoryPointsField({
  value,
  onChange,
  disabled = false,
  className,
}) {
  const currentValue = normalizeStoryPoints(value);
  const currentStyle = getStoryPointsStyle(currentValue);
  const currentLabel = currentValue === null ? "Not set" : `SP ${currentValue}`;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2 text-gray-400 text-sm font-medium">
        <BarChart3 className="w-4 h-4" /> Story Points
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(
             "flex items-center gap-2 px-3 py-1 rounded-md text-xs font-bold uppercase transition-colors outline-none focus:ring-0 focus-visible:ring-0",
              disabled && "cursor-not-allowed opacity-60",
            )}
            aria-label={`Change story points (current: ${currentLabel})`}
          >
            <span className={cn("h-2 w-2 rounded-full", currentStyle.dot)} />
            {currentLabel}
            <ChevronDown className="w-3 h-3 opacity-50" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-44 z-[200]">
          <DropdownMenuItem
            onSelect={() => onChange?.(null)}
            className="cursor-pointer"
          >
            <span className="h-2 w-2 rounded-full bg-gray-400 mr-2" />
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
              >
                <span className={cn("h-2 w-2 rounded-full mr-2", style.dot)} />
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
