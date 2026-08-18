import { cn } from '@/lib/utils';
import { statusDotColor } from '@/helpers/ticketStatus';
import { useThemeConfig } from '@/context/ThemeConfigContext';

/**
 * The tickets control band — the second flat band under the page header, 1:1 with
 * the mockup (`Tickets.dc.html`): status tabs as 32px pills on the left, the
 * controls right, closed by a hairline.
 *
 * Pills, not underlines. The pre-overhaul bar used a 46px `border-b-2` tab strip
 * inside a rounded panel, which read as a second page header stacked on the real
 * one; the mockup's row is a filter chip set, and an active chip is a primary
 * tint fill rather than an underline.
 *
 * `showTabs={false}` keeps the band and its controls but drops the status tabs —
 * the board view filters by column, so the tabs there only duplicated the columns
 * and squeezed the controls (see `TicketPage`).
 */
export default function TicketsTabs({
  activeTab,
  onChange,
  rightSlot,
  bottomSlot,
  className,
  tabsClassName,
  showTabs = true,
  statusTabs = [{ key: 'all', label: 'All' }],
}) {
  const { colorblind } = useThemeConfig();

  return (
    <div className={cn('app-page-content py-0', className)}>
      {/* Bleeds the 48px page gutter to a 24px band gutter, exactly like
          `.app-page-header` above it, so the two bands align. */}
      <div className="-mx-6 flex flex-col border-b border-separator bg-card px-6">
        <div className="flex items-center gap-[14px] py-2.5">
          {showTabs ? (
            <div
              className={cn(
                'flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto',
                tabsClassName
              )}
            >
              {statusTabs.map((tab) => {
                const active = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => onChange(tab.key)}
                    aria-pressed={active}
                    data-test={`tickets-tab-${tab.key}-tab`}
                    className={cn(
                      'flex h-8 flex-none items-center gap-[7px] whitespace-nowrap rounded-[var(--r-control)] px-3 text-[12.5px] transition-colors',
                      active
                        ? 'bg-primary/10 font-semibold text-primary'
                        : 'font-medium text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {tab.color ? (
                      <span
                        className="h-1.5 w-1.5 flex-none rounded-full"
                        // Same story as the board stripe: the colour is workspace
                        // data, so a colour vision mode has to remap it here.
                        style={{ backgroundColor: statusDotColor(tab.color, colorblind !== 'off') }}
                        aria-hidden
                      />
                    ) : null}
                    <span>{tab.label}</span>
                    {typeof tab.count === 'number' ? (
                      <span
                        className={cn(
                          'ml-1.5 text-[11px] font-semibold tabular-nums',
                          active ? 'text-primary' : 'text-muted-foreground/75'
                        )}
                      >
                        {tab.count}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="min-w-0 flex-1" />
          )}

          {rightSlot ? (
            <div className="flex flex-none items-center justify-end gap-2">{rightSlot}</div>
          ) : null}
        </div>

        {bottomSlot ? <div className="pb-2.5">{bottomSlot}</div> : null}
      </div>
    </div>
  );
}
