import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { ChevronDown, Check } from 'lucide-react';
import { extractStatusId, extractStatusSlug } from '@/helpers/normalizeTicket';

export default function StatusDropdown({ status, onChange, className, statusOptions = [] }) {
  const statusSlug = extractStatusSlug(status);
  const statusIdFromRef = extractStatusId(status);
  const statusId =
    statusIdFromRef ||
    (statusOptions.some((option) => option.value === String(status)) ? String(status) : '');

  const active =
    statusOptions.find((option) => option.value === statusId) ||
    statusOptions.find((option) => option.slug === statusSlug) ||
    statusOptions.find((option) => option.label?.toLowerCase() === statusSlug.toLowerCase());

  const displayLabel = active?.label || (statusSlug ? statusSlug : 'Status');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-test="ticket-status-trigger"
          className={cn(
            'flex items-center gap-2 px-3 py-2.5 rounded-[var(--r-control)] text-xs font-bold uppercase transition-colors outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 whitespace-nowrap bg-muted text-foreground hover:bg-muted',
            className
          )}
          style={
            active?.color
              ? { backgroundColor: `${active.color}22`, color: active.color }
              : undefined
          }
          aria-label={`Change status (current: ${displayLabel})`}
        >
          <span className="min-w-0 flex-1 truncate">{displayLabel}</span>
          <ChevronDown className="w-3 h-3 opacity-50" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-48 z-[200]">
        {statusOptions.map((option) => {
          const isSelected = statusId === option.value;

          return (
            <DropdownMenuItem
              key={option.value}
              onSelect={() => onChange(option.value)}
              className="cursor-pointer"
              data-test={`ticket-status-option-${option.value}`}
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
