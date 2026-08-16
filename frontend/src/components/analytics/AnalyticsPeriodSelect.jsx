import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ANALYTICS_PERIODS } from '@/helpers/analyticsFormatters';

export default function AnalyticsPeriodSelect({
  days,
  onDaysChange,
  dataTestPrefix = 'analytics',
}) {
  return (
    <Select value={String(days)} onValueChange={(value) => onDaysChange(Number(value))}>
      {/* The mockup's band control: 32px on a hairline outline over a transparent
          fill, not the primary-tinted pill it used to be — it sits on the tab
          band beside the tabs, where a filled accent would outrank them. */}
      <SelectTrigger
        className="w-auto gap-2 rounded-[var(--r-control)] border-separator bg-transparent px-[11px] text-[12.5px] font-normal text-foreground"
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
            Last {period} days
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
