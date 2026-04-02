import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  PRIORITY_OPTIONS,
  PRIORITY_CONFIG,
} from "@/helpers/ticketPriority";
import { cn } from "@/lib/utils";

export default function PriorityDropdown({
  priority,
  onChange,
  disabled = false,
  className,
}) {
  const currentPriority = priority?.toLowerCase() || "medium";
  const currentConfig = PRIORITY_CONFIG[currentPriority] || PRIORITY_CONFIG.medium;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex items-center gap-2 px-3 py-1 rounded-md text-xs font-bold uppercase transition-colors outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2",
            disabled && "cursor-not-allowed opacity-60",
            className, currentConfig.badge
          )}
        >
          <span className={cn("w-2 h-2 rounded-full", currentConfig.dot)} />
          {currentConfig.label}
          <ChevronDown className="w-3 h-3 opacity-50" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-40 z-[200]">
        {PRIORITY_OPTIONS.map((option) => {
          const config = PRIORITY_CONFIG[option.value];
          const isSelected = currentPriority === option.value;

          return (
            <DropdownMenuItem
              key={option.value}
              onSelect={() => onChange?.(option.value)}
              className="cursor-pointer flex items-center gap-2"
            >
              <span className={cn("w-2 h-2 rounded-full", config.dot)} />
              <span className="flex-1">{option.label}</span>
              {isSelected && <Check className="w-4 h-4 opacity-80" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
