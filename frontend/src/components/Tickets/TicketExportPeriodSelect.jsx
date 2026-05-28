import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EXPORT_PERIOD_OPTIONS } from '@/helpers/ticketFilters';

export default function TicketExportPeriodSelect({ value, onValueChange }) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        className="w-full rounded-xl md:w-[160px]"
        data-test="ticket-export-period-select"
        aria-label="Export time period"
      >
        <SelectValue placeholder="Time period" />
      </SelectTrigger>
      <SelectContent>
        {EXPORT_PERIOD_OPTIONS.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            data-test={`ticket-export-period-option-${option.value}`}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
