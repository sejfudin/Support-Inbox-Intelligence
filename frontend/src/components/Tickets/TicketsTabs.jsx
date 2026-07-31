import { cn } from '@/lib/utils';

export default function TicketsTabs({
  activeTab,
  onChange,
  rightSlot,
  bottomSlot,
  className,
  panelClassName,
  tabsClassName,
  statusTabs = [{ key: 'all', label: 'All' }],
}) {
  return (
    <div className={cn('app-page-content pt-4', className)}>
      <div className={cn('app-panel-soft overflow-hidden rounded-[1.35rem] px-5', panelClassName)}>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-4">
            <div className="min-w-0 flex-1">
              <div
                className={cn(
                  'flex items-center gap-6 overflow-x-auto pl-2 md:pl-3',
                  tabsClassName
                )}
              >
                {statusTabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => onChange(tab.key)}
                    data-test={`tickets-tab-${tab.key}-tab`}
                    className={`flex flex-shrink-0 items-center gap-2 px-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab.key
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {tab.color ? (
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: tab.color }}
                      />
                    ) : null}
                    <span>{tab.label}</span>
                    {typeof tab.count === 'number' ? (
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                        {tab.count}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>

            {rightSlot ? (
              <div className="hidden shrink-0 md:flex md:items-center md:justify-end">
                {rightSlot}
              </div>
            ) : null}
          </div>

          {rightSlot ? <div className="pb-1 md:hidden">{rightSlot}</div> : null}
          {bottomSlot ? <div className="pb-3">{bottomSlot}</div> : null}
        </div>
      </div>
    </div>
  );
}
