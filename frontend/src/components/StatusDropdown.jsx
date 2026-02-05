import React from 'react';
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItem 
} from "@/components/ui/dropdown-menu"; 
import { cn } from "@/lib/utils"; 
import { ChevronDown, Check } from "lucide-react"; 

const STATUS_CONFIG = {
  'To Do':       'bg-gray-200 text-gray-700 hover:bg-gray-300',
  'In Progress': 'bg-blue-200 text-blue-700 hover:bg-blue-300',
  'On Staging':  'bg-purple-200 text-purple-700 hover:bg-purple-300',
  'Blocked':     'bg-red-200 text-red-700 hover:bg-red-300',
  'Done':        'bg-teal-200 text-teal-700 hover:bg-teal-300',
};

export default function StatusDropdown({ status, onChange }) {
  
  const currentStyle = STATUS_CONFIG[status] || 'bg-gray-100 text-gray-600';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-2 px-3 py-1 rounded-md text-xs font-bold uppercase transition-colors outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2",
            currentStyle
          )}
        >
          {status}
          <ChevronDown className="w-3 h-3 opacity-50" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-48">
        {Object.keys(STATUS_CONFIG).map((optionLabel) => (
          <DropdownMenuItem
            key={optionLabel}
            onClick={() => onChange(optionLabel)}
            className="cursor-pointer"
          >
            <span className={cn("w-2 h-2 rounded-full mr-2", STATUS_CONFIG[optionLabel].split(' ')[0])} />
            
            <span className="flex-1">{optionLabel}</span>

            {status === optionLabel && (
              <Check className="w-4 h-4 text-blue-500 ml-2" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}