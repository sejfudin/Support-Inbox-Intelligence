import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { ConfirmModal } from '@/components/Modals/ConfirmModal';
import DailySkeleton from '@/components/Skeletons/DailySkeleton';
import { getAvailableInterns } from '@/helpers/dailyEntrants';
import { Button } from '@/components/ui/button';
import { PageSection, PageShell } from '@/components/PageShell';
import PageHeading from '@/components/PageHeading';
import { LoadingOverlay, useLoaderHold } from '@/components/ui/loader';

const toDateKey = (date) => format(date, 'yyyy-MM-dd');

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * `?date=YYYY-MM-DD` opens the page on that day — the intern dashboard's
 * "View full note" links here for the day it is showing. Parsed at noon so the
 * date can't slide to the neighbouring day in a timezone behind UTC. An invalid
 * or missing param falls back to today rather than erroring.
 */
const parseDateParam = (value) => {
  if (!value || !DATE_KEY_PATTERN.test(value)) return null;
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const WorkspaceDailiesPage = () => {
  const { user } = useAuth();
  const workspaceId = user?.workspaceId;
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedDate, setSelectedDate] = useState(
    () => parseDateParam(searchParams.get('date')) || new Date()
  );
  const dateKey = toDateKey(selectedDate);
  const canStartSelectedDate = isToday(selectedDate);
  const [isAddEntryOpen, setIsAddEntryOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [entryToDelete, setEntryToDelete] = useState(null);

  // Keep the URL on the day being viewed, so a refresh or a shared link lands on
  // the same standup rather than snapping back to today. Today is the default and
  // carries no param, which keeps the plain `/dailies` link in the sidebar clean.
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (isToday(selectedDate)) {
      next.delete('date');
    } else {
      next.set('date', dateKey);
    }
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [dateKey, selectedDate, searchParams, setSearchParams]);

  const { data: dailyResponse, isLoading: isLoadingRaw } = useDaily(workspaceId, dateKey);
  // Global hold: keeps the mark up for MIN_VISIBLE_MS once it appears, and until the data is in.
  const isLoading = useLoaderHold(isLoadingRaw);
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
      <PageSection className="flex flex-col gap-3.5">
        <PageHeading
          crumb="Workspace"
          title="Dailies"
          subtitle="Daily standup for everyone in this workspace."
        />

        {/* The date row and the four counts are one card in the mockup — they read
            as a single "which day, and how did it go" band. The standup cards are
            siblings below it, not nested inside a second panel. */}
        <section className="rounded-[var(--r-card)] border border-border bg-card px-4 pb-3.5 pt-[13px]">
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
                  className="h-[30px] rounded-[var(--r-control)] px-3 text-[12px]"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add entry
                </Button>
              )
            }
          />
          {!isLoading && daily ? <DailyHeader counts={daily.counts} /> : null}
        </section>

        {isLoading && (
          <LoadingOverlay label="Loading standup">
            <DailySkeleton />
          </LoadingOverlay>
        )}
        {!isLoading && daily && (
          <>
            {daily.entries.length === 0 ? (
              <p className="rounded-[var(--r-card)] border border-dashed border-border py-8 text-center text-[12.5px] text-muted-foreground/75">
                No entries yet — add the first standup entry.
              </p>
            ) : (
              <div className="flex flex-col gap-3.5">
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
                className="flex h-11 items-center justify-center gap-1.5 rounded-[var(--r-card)] border border-dashed border-border text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
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
            <ConfirmModal
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
      </PageSection>
    </PageShell>
  );
};

export default WorkspaceDailiesPage;
