import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ANALYTICS_PERIODS } from '@/helpers/analyticsFormatters';

export default function AnalyticsPeriodSelect({ days, onDaysChange, dataTestPrefix = 'analytics' }) {
  return (
    <Select value={String(days)} onValueChange={(value) => onDaysChange(Number(value))}>
      <SelectTrigger
        className="w-[140px] rounded-full border-primary/15 bg-primary/10 text-primary"
        data-test={`${dataTestPrefix}-period-select`}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ANALYTICS_PERIODS.map((period) => (
          <SelectItem
            key={period}
            value={String(period)}
            data-test={`${dataTestPrefix}-period-option-${period}`}
          >
            Last {period} Days
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
