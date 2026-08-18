import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { REQUEST_GROUPS, countRequestsByGroup } from '@/helpers/staffingRequests';

// The app's tab band trigger — the same string Attendance, Analytics, Absence
// requests and Platform management use. Underline, not a pill: this is page
// navigation, and it has to read as the same control on every route.
const tabTriggerClass =
  'mx-2.5 h-11 rounded-none border-0 bg-transparent px-1 text-[13px] font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-[inset_0_-2px_0_hsl(var(--primary))]';

// Open is live work, Closed is settled. `All` carries no dot on purpose: it is
// not a status, it is the absence of one, and a swatch would imply a third
// colour on the cards below.
const TONE_DOT = {
  active: 'bg-primary',
  muted: 'bg-muted-foreground/40',
};

/**
 * All / Open / Closed — the stored status and nothing else, so the counts
 * partition the list and always sum to All.
 *
 * Rendered as the page's tab band: bled out of the content gutter so its surface
 * spans the full column, then padded back to the same 24px the cards below start
 * at, sitting flush under the page header. `Tabs` is used for the trigger
 * behaviour only — the list underneath is one set of cards filtered by `value`,
 * not three `TabsContent` panes — so this component owns the whole band and the
 * page renders its content after it.
 *
 * `rightSlot` is the band's right-hand caption, the same place Attendance puts
 * its filters and Absence requests puts its queue count.
 */
export function RequestGroupTabs({ requests, value, onChange, rightSlot }) {
  const counts = countRequestsByGroup(requests);

  return (
    <Tabs value={value} onValueChange={onChange}>
      <div className="-mx-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-separator bg-card px-6">
        <TabsList
          className="-mx-2.5 flex h-auto justify-start gap-1 rounded-none bg-transparent p-0"
          data-test="requests-tabs"
        >
          {REQUEST_GROUPS.map((group) => (
            <TabsTrigger
              key={group.key}
              value={group.key}
              className={cn(tabTriggerClass, 'gap-1.5')}
              data-test={`requests-tab-${group.key}`}
            >
              {group.tone && (
                <span
                  className={cn('h-1.5 w-1.5 shrink-0 rounded-full', TONE_DOT[group.tone])}
                  aria-hidden="true"
                />
              )}
              {group.label}
              <span className="tabular-nums text-muted-foreground/70">
                {counts[group.key] ?? 0}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {rightSlot ? <span className="my-2 shrink-0">{rightSlot}</span> : null}
      </div>
    </Tabs>
  );
}
