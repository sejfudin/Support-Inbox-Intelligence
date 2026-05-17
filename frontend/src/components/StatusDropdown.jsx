import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { ChevronDown, Check } from 'lucide-react';
import { extractStatusSlug } from '@/helpers/normalizeTicket';

export default function StatusDropdown({ status, onChange, className, statusOptions = [] }) {
  const statusSlug = extractStatusSlug(status);
  const normalizedStatus = statusSlug.toLowerCase();
  const active =
    statusOptions.find((option) => option.value === normalizedStatus) ||
    statusOptions.find((option) => option.label?.toLowerCase() === normalizedStatus);

  const displayLabel = active?.label || statusSlug || 'Status';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex items-center gap-2 px-3 py-2.5 rounded-md text-xs font-bold uppercase transition-colors outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 whitespace-nowrap bg-slate-100 text-slate-700 hover:bg-slate-200',
            className
          )}
          style={active?.color ? { backgroundColor: `${active.color}22`, color: active.color } : undefined}
          aria-label={`Change status (current: ${displayLabel})`}
        >
          <span className="min-w-0 flex-1 truncate">{displayLabel}</span>
          <ChevronDown className="w-3 h-3 opacity-50" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-48 z-[200]">
        {statusOptions.map((option) => {
          const isSelected = normalizedStatus === option.value;

          return (
            <DropdownMenuItem
              key={option.value}
              onSelect={() => onChange(option.value)}
              className="cursor-pointer"
            >
              <span
                className="w-2 h-2 rounded-full mr-2 shrink-0"
                style={{ backgroundColor: option.color || '#94a3b8' }}
              />
              <span className="flex-1">{option.label}</span>
              {isSelected && <Check className="w-4 h-4 opacity-80 ml-2" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
