import { useState } from 'react';
import { format } from 'date-fns';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useDaily, useStartDaily } from '@/queries/dailies';
import { DailyHeader } from '@/components/dailies/DailyHeader';
import { DailyEmptyState } from '@/components/dailies/DailyEmptyState';
import { DailyEntryCard } from '@/components/dailies/DailyEntryCard';
import { AddEntryModal } from '@/components/dailies/AddEntryModal';
import { getAvailableInterns } from '@/helpers/dailyEntrants';
import { Button } from '@/components/ui/button';
import { PagePanel, PageSection, PageShell } from '@/components/PageShell';

const toDateKey = (date) => format(date, 'yyyy-MM-dd');

const WorkspaceDailiesPage = () => {
  const { user } = useAuth();
  const workspaceId = user?.workspaceId;
  const [selectedDate] = useState(() => new Date());
  const dateKey = toDateKey(selectedDate);
  const [isAddEntryOpen, setIsAddEntryOpen] = useState(false);

  const { data: dailyResponse, isLoading } = useDaily(workspaceId, dateKey);
  const startDailyMutation = useStartDaily(workspaceId);

  const daily = dailyResponse?.data ?? null;
  const availableInterns = getAvailableInterns(daily);

  const handleStart = () => {
    startDailyMutation.mutate(dateKey, {
      onError: (error) => {
        toast.error('Could not start today’s daily', {
          description: error?.response?.data?.message,
        });
      },
    });
  };

  return (
    <PageShell>
      <PageSection>
        <PagePanel className="flex flex-col gap-4 p-6">
          {!isLoading && daily && (
            <>
              <div className="flex items-start justify-between gap-3">
                <DailyHeader
                  date={new Date(daily.date)}
                  scribeName={daily.scribe?.fullname}
                  counts={daily.counts}
                />
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={() => setIsAddEntryOpen(true)}
                  disabled={availableInterns.length === 0}
                  data-test="add-entry-button"
                >
                  <Plus className="h-4 w-4" />
                  Add entry
                </Button>
              </div>
              {daily.entries.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No entries yet — add the first standup entry.
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {daily.entries.map((entry) => (
                    <DailyEntryCard key={entry._id} entry={entry} />
                  ))}
                </div>
              )}
              <AddEntryModal
                open={isAddEntryOpen}
                onOpenChange={setIsAddEntryOpen}
                workspaceId={workspaceId}
                daily={daily}
              />
            </>
          )}
          {!isLoading && !daily && (
            <DailyEmptyState
              canStart
              onStart={handleStart}
              isStarting={startDailyMutation.isPending}
            />
          )}
        </PagePanel>
      </PageSection>
    </PageShell>
  );
};

export default WorkspaceDailiesPage;
