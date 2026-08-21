import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { REQUEST_GROUPS, countRequestsByGroup } from '@/helpers/staffingRequests';

/**
 * All / Open / Closed — the stored status and nothing else, so the counts
 * partition the list and always sum to All.
 */
export function RequestsFilterTabs({ requests, value, onChange }) {
  const counts = countRequestsByGroup(requests);

  return (
    <Tabs value={value} onValueChange={onChange}>
      <TabsList className="symphony-tabs-list h-auto gap-1 bg-transparent">
        {REQUEST_GROUPS.map((group) => (
          <TabsTrigger
            key={group.key}
            value={group.key}
            className="symphony-tab-trigger gap-2 px-4 py-1.5 text-sm"
            data-test={`requests-tab-${group.key}`}
          >
            {group.label}
            <span className="text-xs opacity-70">{counts[group.key] ?? 0}</span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
