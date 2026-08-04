import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { SymphonyCard } from '@/components/symphony/SymphonyCard';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// Shared hover-triggered "what does this metric mean" popover, used inside
// KpiCard below. Extracted alongside KpiCard so any KPI row (programme
// dashboard, projects) gets the same explainer affordance for free.
export function InfoPopover({ title, children }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`What does “${title}” mean?`}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          className="text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--symphony-brand))]/40 rounded-full"
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-64"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <div className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{children}</div>
      </PopoverContent>
    </Popover>
  );
}

// Clickable KPI tile: the whole card links to `to` (a pre-filtered list URL),
// with an optional secondary `action` button (e.g. "See details", scrolls
// instead of navigating) and an optional InfoPopover explaining the metric.
export function KpiCard({ label, value, sub, hint, dot, highlighted, info, to, testId, action }) {
  return (
    <SymphonyCard
      variant="muted"
      className="relative overflow-hidden p-0 transition-shadow hover:shadow-md"
    >
      {highlighted && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[hsl(var(--symphony-brand)/0.1)]"
        />
      )}
      {to && (
        <Link
          to={to}
          aria-label={`View details: ${label}`}
          data-test={testId}
          className="absolute inset-0 z-[1] rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[hsl(var(--symphony-brand))]/40"
        />
      )}
      <div className="relative px-5 py-[22px]">
        <div className="flex items-center gap-2">
          <span
            className="h-[9px] w-[9px] shrink-0 rounded-[3px]"
            style={{ backgroundColor: dot }}
          />
          <span className="text-[12.5px] font-semibold text-foreground/80">{label}</span>
          {info && (
            <span className="relative z-[2] ml-auto">
              <InfoPopover title={label}>{info}</InfoPopover>
            </span>
          )}
        </div>
        <div className="mt-3.5 flex items-baseline gap-2">
          <span className="text-[48px] font-bold leading-none tracking-tight text-foreground tabular-nums">
            {value}
          </span>
          {sub && (
            <span className="text-[13px] font-medium text-foreground/60">
              <span className="mr-1 text-foreground/40">/</span>
              {sub}
            </span>
          )}
        </div>
        {hint && <p className="mt-2.5 text-xs leading-snug text-muted-foreground">{hint}</p>}
        {action && (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              action.onClick();
            }}
            className="relative z-[2] mt-3 inline-flex items-center gap-0.5 text-xs font-semibold text-[hsl(var(--symphony-brand-strong))] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--symphony-brand))]/40 dark:text-[hsl(var(--symphony-brand))]"
          >
            {action.label}
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </SymphonyCard>
  );
}
