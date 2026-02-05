import React from "react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ChevronDown, Check } from "lucide-react";

const STATUS_CONFIG = {
  "To Do": { badge: "bg-gray-200 text-gray-700 hover:bg-gray-300", dot: "bg-gray-500" },
  "In Progress": { badge: "bg-blue-200 text-blue-700 hover:bg-blue-300", dot: "bg-blue-500" },
  "On Staging": { badge: "bg-purple-200 text-purple-700 hover:bg-purple-300", dot: "bg-purple-500" },
  Blocked: { badge: "bg-red-200 text-red-700 hover:bg-red-300", dot: "bg-red-500" },
  Done: { badge: "bg-teal-200 text-teal-700 hover:bg-teal-300", dot: "bg-teal-500" },
};

export default function StatusDropdown({ status, onChange }) {
  const activeStatusKey = Object.keys(STATUS_CONFIG).find(
    (key) => key.toUpperCase() === status?.toUpperCase()
  ) || status;

  const config =
    STATUS_CONFIG[activeStatusKey] || 
    { badge: "bg-gray-100 text-gray-600", dot: "bg-gray-400" };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-2 px-3 py-1 rounded-md text-xs font-bold uppercase transition-colors outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2",
            config.badge
          )}
          aria-label={`Change status (current: ${status})`}
        >
          {status}
          <ChevronDown className="w-3 h-3 opacity-50" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-48 z-[200]">
        {Object.keys(STATUS_CONFIG).map((optionLabel) => {
          const optionConfig = STATUS_CONFIG[optionLabel];
          const isSelected = status === optionLabel;

          return (
            <DropdownMenuItem
              key={optionLabel}
              onSelect={(e) => {
              e.preventDefault();
              onChange(optionLabel);
            }}

              className="cursor-pointer"
            >
              <span className={cn("w-2 h-2 rounded-full mr-2", optionConfig.dot)} />
              <span className="flex-1">{optionLabel}</span>

              {isSelected && <Check className="w-4 h-4 opacity-80 ml-2" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
