import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { SortControl } from '@/components/interns/SortControl';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { canWriteInternMentorData } from '@/helpers/roles';
import { getRecommendationStatusLabel, RECOMMENDATION_STATUSES } from '@/helpers/recommendations';
import { usePositions } from '@/queries/positions';
import { useTechnologies } from '@/queries/technologies';
import {
  useCreateRecommendation,
  useDeleteRecommendation,
  useRecommendations,
  useUpdateRecommendation,
} from '@/queries/recommendations';
import {
  RecommendationCard,
  RecommendationCompactRow,
} from '@/components/interns/recommendations/RecommendationCards';
import {
  RecommendationDeleteDialog,
  RecommendationFormModal,
  RecommendationViewModal,
} from '@/components/interns/recommendations/RecommendationModals';
import {
  buildTimelineSteps,
  REC_FONT,
} from '@/components/interns/recommendations/recommendationUi';

// Detailed / Compact list rendering, persisted so it survives reloads.
const VIEW_MODE_STORAGE_KEY = 'recommendations-view-mode';

const SORT_OPTIONS = [
  { key: 'updated', label: 'Updated' },
  { key: 'status', label: 'Status' },
  { key: 'position', label: 'Position' },
];

// Keys whose values are numeric (dates) — these default to descending (newest
// first); text keys default to ascending (A→Z), same as the other sections.
const NUMERIC_SORT_KEYS = ['updated'];

const todayInputDate = () => format(new Date(), 'yyyy-MM-dd');

const toInputDate = (date) => (date ? format(new Date(date), 'yyyy-MM-dd') : '');

const createEmptyForm = () => ({
  positionId: '',
  project: '',
  technologyIds: [],
  recommendationNote: '',
  status: 'recommended',
  resultOutcome: 'none',
  resultNote: '',
  statusDates: { recommended: todayInputDate(), interviewing: '', resulted: '' },
  interviewingSkipped: false,
});

const formFromRecommendation = (recommendation) => {
  const dates = recommendation.statusDates || {};
  const status = recommendation.status || 'recommended';
  // Same fallback the card uses: a reached current stage with no recorded date
  // (records that predate stored status dates) shows the record's updatedAt —
  // without this the edit form rendered an empty Resulted date while the card
  // displayed one.
  const currentFallback = toInputDate(recommendation.updatedAt);
  return {
    positionId: recommendation.position?._id || recommendation.position || '',
    project: recommendation.project || '',
    technologyIds: (recommendation.technologies || []).map((technology) => technology._id),
    recommendationNote: recommendation.recommendationNote || '',
    status,
    resultOutcome: recommendation.result?.outcome || 'none',
    resultNote: recommendation.result?.note || '',
    statusDates: {
      recommended:
        toInputDate(dates.recommended) ||
        (status === 'recommended' ? currentFallback : toInputDate(recommendation.createdAt)) ||
        todayInputDate(),
      interviewing:
        toInputDate(dates.interviewing) || (status === 'interviewing' ? currentFallback : ''),
      resulted: toInputDate(dates.resulted) || (status === 'resulted' ? currentFallback : ''),
    },
    // A resulted recommendation with no interviewing date means the stage was
    // skipped — a distinct state from "not reached yet".
    interviewingSkipped: status === 'resulted' && !dates.interviewing,
  };
};

function ViewModeSwitcher({ value, onChange }) {
  return (
    <div className="flex h-11 items-center gap-1 rounded-xl bg-[#f2f3f8] p-1">
      {['detailed', 'compact'].map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          className={cn(
            'h-full rounded-[9px] px-[18px] text-[14px] font-semibold capitalize transition',
            value === mode
              ? 'bg-[#6d5ce6] text-white shadow-[0_2px_8px_rgba(109,92,230,.35)]'
              : 'text-[#4a5064] hover:text-[#171b2b]'
          )}
          aria-pressed={value === mode}
          data-test={`recommendation-view-${mode}`}
        >
          {mode}
        </button>
      ))}
    </div>
  );
}

export function InternRecommendationsPanel({ userId, readOnly = false }) {
  const { user } = useAuth();
  const canWrite = !readOnly && canWriteInternMentorData(user?.role);
  const { data: positions = [] } = usePositions();
  const { data: technologies = [] } = useTechnologies();
  const { data, isPending, isError } = useRecommendations({
    internUserId: userId,
    limit: 50,
  });
  const { mutate: createRecommendation, isPending: isCreating } = useCreateRecommendation();
  const { mutate: updateRecommendation, isPending: isUpdating } = useUpdateRecommendation();
  const { mutate: deleteRecommendation, isPending: isDeleting } = useDeleteRecommendation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailRecommendation, setDetailRecommendation] = useState(null);
  const [activeRecommendation, setActiveRecommendation] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState(createEmptyForm);
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState('desc');
  const [viewMode, setViewMode] = useState(() =>
    localStorage.getItem(VIEW_MODE_STORAGE_KEY) === 'compact' ? 'compact' : 'detailed'
  );

  const recommendations = data?.recommendations ?? [];
  const isSaving = isCreating || isUpdating;
  const isEditing = Boolean(activeRecommendation);
  // A result already recorded on the server. The backend can change a recorded
  // outcome but never remove it, so the form keeps the outcome visible even
  // when the status moves back off "resulted".
  const hasRecordedOutcome = Boolean(activeRecommendation?.result?.outcome);

  const positionName = (recommendation) => recommendation?.position?.name || 'Position not set';

  const changeViewMode = (mode) => {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  };

  // The edit form is seeded once from the record when the dialog opens
  // (handleEdit). We deliberately do NOT re-sync it from `recommendations` on
  // every refetch — doing so overwrote the user's in-progress edits mid-typing.

  const handleNew = () => {
    setActiveRecommendation(null);
    setForm(createEmptyForm());
    setDialogOpen(true);
  };

  const handleEdit = (recommendation) => {
    setActiveRecommendation(recommendation);
    setForm(formFromRecommendation(recommendation));
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.positionId) {
      toast.error('Select a position for this recommendation');
      return;
    }
    if (!form.project.trim()) {
      toast.error('Enter the project for this recommendation');
      return;
    }

    // Stage dates must not run backwards ('yyyy-MM-dd' strings compare
    // lexicographically). The server enforces the same rule.
    const dates = form.statusDates;
    const interviewingDate = form.interviewingSkipped ? '' : dates.interviewing;
    if (interviewingDate && dates.recommended && interviewingDate < dates.recommended) {
      toast.error("Interviewing date can't be before the Recommended date");
      return;
    }
    if (dates.resulted) {
      const previousDate = interviewingDate || dates.recommended;
      if (previousDate && dates.resulted < previousDate) {
        toast.error("Resulted date can't be before the earlier stage dates");
        return;
      }
    }

    const payload = {
      internUserId: userId,
      positionId: form.positionId,
      project: form.project.trim(),
      technologyIds: form.technologyIds,
      recommendationNote: form.recommendationNote,
      status: form.status,
    };

    // Per-stage dates: only stages the status has reached carry one. An
    // explicit null interviewing date on a resulted recommendation means the
    // stage was skipped.
    if (isEditing) {
      const statusIndex = RECOMMENDATION_STATUSES.findIndex(
        (status) => status.value === form.status
      );
      const statusDates = { recommended: form.statusDates.recommended || undefined };
      if (statusIndex >= 1) {
        statusDates.interviewing = form.interviewingSkipped
          ? null
          : form.statusDates.interviewing || undefined;
      }
      if (statusIndex >= 2) {
        statusDates.resulted = form.statusDates.resulted || undefined;
      }
      payload.statusDates = statusDates;
    } else {
      payload.statusDates = { recommended: form.statusDates.recommended || undefined };
    }

    // Placement outcome only applies to a resulted recommendation; ignore any
    // stale outcome if the status isn't 'resulted' (the section shows a
    // read-only notice then instead of editable fields).
    if (activeRecommendation && form.status === 'resulted' && form.resultOutcome !== 'none') {
      payload.result = {
        outcome: form.resultOutcome,
        note: form.resultNote,
      };
    }

    const options = {
      onSuccess: () => {
        toast.success(activeRecommendation ? 'Recommendation updated' : 'Recommendation created');
        setDialogOpen(false);
        setActiveRecommendation(null);
        setForm(createEmptyForm());
      },
      onError: (err) =>
        toast.error(err?.response?.data?.message || 'Failed to save recommendation'),
    };

    if (activeRecommendation) {
      updateRecommendation({ id: activeRecommendation._id, payload }, options);
    } else {
      createRecommendation(payload, options);
    }
  };

  // Deleting also dismisses any open modal showing the removed record.
  const handleDeleteConfirm = () => {
    if (!deleteTarget || isDeleting) return;
    deleteRecommendation(deleteTarget._id, {
      onSuccess: () => {
        toast.success('Recommendation deleted');
        if (detailRecommendation?._id === deleteTarget._id) setDetailRecommendation(null);
        if (activeRecommendation?._id === deleteTarget._id) {
          setDialogOpen(false);
          setActiveRecommendation(null);
        }
        setDeleteTarget(null);
      },
      onError: (err) =>
        toast.error(err?.response?.data?.message || 'Failed to delete recommendation'),
    });
  };

  const handleSortKeyChange = (key) => {
    setSortKey(key);
    if (key) setSortDir(NUMERIC_SORT_KEYS.includes(key) ? 'desc' : 'asc');
  };

  const sorted = useMemo(() => {
    const byUpdated = [...recommendations].sort(
      (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
    );
    if (!sortKey) return byUpdated;
    const factor = sortDir === 'asc' ? 1 : -1;
    const valueOf = (recommendation) => {
      if (sortKey === 'updated') return new Date(recommendation.updatedAt).getTime();
      if (sortKey === 'status') return getRecommendationStatusLabel(recommendation.status);
      return positionName(recommendation);
    };
    return byUpdated.sort((a, b) => {
      const av = valueOf(a);
      const bv = valueOf(b);
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * factor;
      return String(av ?? '').localeCompare(String(bv ?? '')) * factor;
    });
  }, [recommendations, sortKey, sortDir]);

  // Count from the server, not from the fetched page — the query is capped at
  // the API's max page size (50), so an intern with more records would
  // otherwise be silently undercounted. When truncated, say so.
  const totalCount = data?.pagination?.total ?? sorted.length;
  const subtitle =
    totalCount > sorted.length
      ? `${totalCount} recommendations · showing the latest ${sorted.length}`
      : `${sorted.length} recommendation${sorted.length === 1 ? '' : 's'}`;

  const timelineSteps = (recommendation) =>
    buildTimelineSteps(
      recommendation,
      RECOMMENDATION_STATUSES.map(({ value, label }) => ({ key: value, label }))
    );

  return (
    <div className={cn('space-y-4 text-[#171b2b]', REC_FONT)}>
      {/* Header card */}
      <div className="rounded-[18px] border border-[#e7e9ef] bg-white px-6 py-5 shadow-[0_1px_3px_rgba(20,24,40,.06)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[22px] font-bold text-[#171b2b]">Recommendation history</h2>
            <p className="text-[13.5px] text-[#8b91a5]">{subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <SortControl
              sortKey={sortKey}
              sortDir={sortDir}
              options={SORT_OPTIONS}
              onSortKeyChange={handleSortKeyChange}
              onToggleDir={() => setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
              className="h-11 border-[#dcdfe9] bg-white"
              triggerClassName="text-[14px] font-semibold text-[#33384c]"
              dataTest="recommendation-history-sort"
            />
            <ViewModeSwitcher value={viewMode} onChange={changeViewMode} />
            {canWrite && (
              <button
                type="button"
                onClick={handleNew}
                className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-[#6d5ce6] px-[18px] text-[14px] font-semibold text-white shadow-[0_2px_8px_rgba(109,92,230,.35)] transition hover:bg-[#5a48d6]"
                data-test="recommendation-history-new-button"
              >
                <Plus className="h-4 w-4" />
                New recommendation
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className={cn('flex flex-col', viewMode === 'compact' ? 'gap-3' : 'gap-4')}>
        {isPending && <p className="py-8 text-center text-[13.5px] text-[#8b91a5]">Loading…</p>}
        {!isPending && sorted.length === 0 && (
          <p className="py-12 text-center text-[13.5px] text-[#8b91a5]">
            {isError ? 'Failed to load recommendations.' : 'No recommendations recorded yet.'}
          </p>
        )}
        {!isPending &&
          sorted.map((recommendation) => {
            const shared = {
              recommendation,
              steps: timelineSteps(recommendation),
              positionName: positionName(recommendation),
              canWrite,
              onOpen: () => setDetailRecommendation(recommendation),
            };
            return viewMode === 'compact' ? (
              <RecommendationCompactRow key={recommendation._id} {...shared} />
            ) : (
              <RecommendationCard
                key={recommendation._id}
                {...shared}
                onReadMore={() => setDetailRecommendation(recommendation)}
              />
            );
          })}
      </div>

      <RecommendationFormModal
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        isEditing={isEditing}
        form={form}
        setForm={setForm}
        statuses={RECOMMENDATION_STATUSES}
        positions={positions}
        technologies={technologies}
        activeRecommendation={activeRecommendation}
        hasRecordedOutcome={hasRecordedOutcome}
        positionName={positionName}
        todayInputDate={todayInputDate}
        isSaving={isSaving}
        onSubmit={handleSubmit}
        onDelete={() => setDeleteTarget(activeRecommendation)}
      />

      {detailRecommendation && (
        <RecommendationViewModal
          recommendation={detailRecommendation}
          steps={timelineSteps(detailRecommendation)}
          positionName={positionName(detailRecommendation)}
          canWrite={canWrite}
          onClose={() => setDetailRecommendation(null)}
          onEdit={() => {
            const target = detailRecommendation;
            setDetailRecommendation(null);
            handleEdit(target);
          }}
          onDelete={() => setDeleteTarget(detailRecommendation)}
        />
      )}

      <RecommendationDeleteDialog
        recommendation={deleteTarget}
        positionName={positionName}
        isDeleting={isDeleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
