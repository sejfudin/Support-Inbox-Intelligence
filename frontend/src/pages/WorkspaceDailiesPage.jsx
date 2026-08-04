import { useMemo, useState } from 'react';
import { format, addDays, subDays, isToday } from 'date-fns';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useDaily, useDailyHistory, useStartDaily, useRemoveDailyEntry } from '@/queries/dailies';
import { DailyDateNav } from '@/components/dailies/DailyDateNav';
import { DailyHeader } from '@/components/dailies/DailyHeader';
import { DailyEmptyState } from '@/components/dailies/DailyEmptyState';
import { DailyEntryCard } from '@/components/dailies/DailyEntryCard';
import { AddEntryModal } from '@/components/dailies/AddEntryModal';
import { DeleteConfirmModal } from '@/components/Modals/DeleteConfirmModal';
import DailySkeleton from '@/components/Skeletons/DailySkeleton';
import { getAvailableInterns } from '@/helpers/dailyEntrants';
import { Button } from '@/components/ui/button';
import { PagePanel, PageSection, PageShell } from '@/components/PageShell';

const toDateKey = (date) => format(date, 'yyyy-MM-dd');

const WorkspaceDailiesPage = () => {
  const { user } = useAuth();
  const workspaceId = user?.workspaceId;
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const dateKey = toDateKey(selectedDate);
  const canStartSelectedDate = isToday(selectedDate);
  const [isAddEntryOpen, setIsAddEntryOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [entryToDelete, setEntryToDelete] = useState(null);

  const { data: dailyResponse, isLoading } = useDaily(workspaceId, dateKey);
  const { data: historyResponse } = useDailyHistory(workspaceId);
  const startDailyMutation = useStartDaily(workspaceId);
  const removeEntryMutation = useRemoveDailyEntry(workspaceId);

  const daily = dailyResponse?.data ?? null;
  const availableInterns = getAvailableInterns(daily);
  const sortedEntries = useMemo(
    () =>
      [...(daily?.entries ?? [])].sort(
        (a, b) => (b.blockers?.length ?? 0) - (a.blockers?.length ?? 0)
      ),
    [daily]
  );
  const recordedDateKeys = useMemo(
    () => new Set((historyResponse?.data ?? []).map((entry) => toDateKey(new Date(entry.date)))),
    [historyResponse]
  );

  const handleStart = () => {
    startDailyMutation.mutate(dateKey, {
      onError: (error) => {
        toast.error('Could not start today’s daily', {
          description: error?.response?.data?.message,
        });
      },
    });
  };

  const handleConfirmRemove = () => {
    removeEntryMutation.mutate(
      { dailyId: daily._id, entryId: entryToDelete._id },
      {
        onSuccess: () => {
          toast.success('Entry removed');
          setEntryToDelete(null);
        },
        onError: (error) => {
          toast.error('Could not remove entry', { description: error?.response?.data?.message });
        },
      }
    );
  };

  return (
    <PageShell>
      <PageSection>
        <PagePanel className="flex flex-col gap-4 p-6">
          <DailyDateNav
            date={selectedDate}
            scribeName={daily?.scribe?.fullname}
            onPrev={() => setSelectedDate((current) => subDays(current, 1))}
            onNext={() => setSelectedDate((current) => addDays(current, 1))}
            onToday={() => setSelectedDate(new Date())}
            hasPrevRecord={recordedDateKeys.has(toDateKey(subDays(selectedDate, 1)))}
            hasNextRecord={recordedDateKeys.has(toDateKey(addDays(selectedDate, 1)))}
            actions={
              daily?.isEditable && (
                <Button
                  onClick={() => setIsAddEntryOpen(true)}
                  disabled={availableInterns.length === 0}
                  data-test="add-entry-button"
                >
                  <Plus className="h-4 w-4" />
                  Add entry
                </Button>
              )
            }
          />
          {isLoading && <DailySkeleton />}
          {!isLoading && daily && (
            <>
              <DailyHeader counts={daily.counts} />
              {daily.entries.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No entries yet — add the first standup entry.
                </p>
              ) : (
                <div className="flex flex-col gap-4">
                  {sortedEntries.map((entry) => (
                    <DailyEntryCard
                      key={entry._id}
                      entry={entry}
                      isEditable={daily.isEditable}
                      onEdit={setEditingEntry}
                      onRemove={setEntryToDelete}
                    />
                  ))}
                </div>
              )}
              {daily.isEditable && availableInterns.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsAddEntryOpen(true)}
                  data-test="add-entry-footer-button"
                  className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border/70 py-4 text-sm font-medium text-muted-foreground transition-colors hover:border-border hover:text-foreground"
                >
                  <Plus className="h-4 w-4" />
                  Add entry for another member
                </button>
              )}
              <AddEntryModal
                open={isAddEntryOpen || Boolean(editingEntry)}
                onOpenChange={(nextOpen) => {
                  if (!nextOpen) {
                    setIsAddEntryOpen(false);
                    setEditingEntry(null);
                  }
                }}
                workspaceId={workspaceId}
                daily={daily}
                entry={editingEntry}
                date={selectedDate}
              />
              <DeleteConfirmModal
                isOpen={Boolean(entryToDelete)}
                onClose={() => setEntryToDelete(null)}
                onConfirm={handleConfirmRemove}
                isLoading={removeEntryMutation.isPending}
                title="Remove entry"
                description={`Remove ${entryToDelete?.member?.fullname ?? 'this'}'s entry for this daily? This can't be undone.`}
                confirmLabel="Remove"
                loadingLabel="Removing..."
              />
            </>
          )}
          {!isLoading && !daily && (
            <DailyEmptyState
              canStart={canStartSelectedDate}
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
