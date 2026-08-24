import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { SortControl } from '@/components/interns/SortControl';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { ROLES } from '@/helpers/roles';
import {
  activeRecommendationsOnOtherProjects,
  getRecommendationStatusLabel,
  isRecommendBlockedByProfileStatus,
  recommendBlockedReason,
  recommendationProjectName,
  RECOMMENDATION_STATUSES,
} from '@/helpers/recommendations';
import { useIntern } from '@/queries/interns';
import { usePositions } from '@/queries/positions';
import { useProjects } from '@/queries/projects';
import { useTechnologies } from '@/queries/technologies';
import { readStoredPreference, writeStoredPreference } from '@/hooks/useStoredPreference';
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
  RecommendationDuplicateWarnDialog,
  RecommendationFormModal,
  RecommendationViewModal,
} from '@/components/interns/recommendations/RecommendationModals';
import {
  BTN_PRIMARY_CLASS,
  BTN_PRIMARY_DISABLED_CLASS,
  buildTimelineSteps,
  REC_FONT,
} from '@/components/interns/recommendations/recommendationUi';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import PanelBodySkeleton from '@/components/Skeletons/PanelBodySkeleton';
import { LoadingOverlay, useLoaderHold } from '@/components/ui/loader';

// Detailed / Compact list rendering, persisted so it survives reloads.
//
// Read and written through `helpers/storedPreference`, never `localStorage`
// directly: the raw call in the `useState` initialiser threw during render in
// any browser with storage blocked (private mode, a locked-down profile, an
// embedded webview), which took the whole Recommendations panel down with it
// rather than falling back to the default view. The write had the same problem
// on click, one frame later.
const VIEW_MODE_STORAGE_KEY = 'recommendations-view-mode';
const VIEW_MODES = ['detailed', 'compact'];
const isViewMode = (value) => VIEW_MODES.includes(value);

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
  projectId: '',
  projectUnknown: false,
  technologyIds: [],
  recommendationNote: '',
  status: 'recommended',
  resultOutcome: 'none',
  resultNote: '',
  startDate: '',
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
  // The Resulted date *as the form will render it*, fallback included. The start
  // date backfill below has to agree with what the user sees in that field — read
  // the raw stored value instead and a legacy record shows a Resulted date beside
  // an empty Start date, so saving it silently drops the intern's exemption.
  const resultedDate =
    toInputDate(dates.resulted) || (status === 'resulted' ? currentFallback : '');
  return {
    positionId: recommendation.position?._id || recommendation.position || '',
    projectId: recommendation.project?._id || recommendation.project || '',
    // Reflects the record's actual state: unticking is how the admin declares
    // it now known and reveals the select to fill it in.
    projectUnknown: !recommendation.project,
    technologyIds: (recommendation.technologies || []).map((technology) => technology._id),
    recommendationNote: recommendation.recommendationNote || '',
    status,
    resultOutcome: recommendation.result?.outcome || 'none',
    resultNote: recommendation.result?.note || '',
    // The intern's first day on the project. Placements recorded before this
    // field existed fall back to their Resulted date, which is what was already
    // driving their attendance exemption — so opening an old record and saving
    // it keeps the exemption it had instead of silently lifting it.
    startDate:
      toInputDate(recommendation.result?.startDate) ||
      (recommendation.result?.outcome === 'placed' ? resultedDate : ''),
    statusDates: {
      recommended:
        toInputDate(dates.recommended) ||
        (status === 'recommended' ? currentFallback : toInputDate(recommendation.createdAt)) ||
        todayInputDate(),
      interviewing:
        toInputDate(dates.interviewing) || (status === 'interviewing' ? currentFallback : ''),
      resulted: resultedDate,
    },
    // A resulted recommendation with no interviewing date means the stage was
    // skipped — a distinct state from "not reached yet".
    interviewingSkipped: status === 'resulted' && !dates.interviewing,
  };
};

function ViewModeSwitcher({ value, onChange }) {
  return (
    // A segmented control, not two buttons: the filled-primary "Detailed" it used
    // to draw competed with the actual primary action beside it ("New
    // recommendation"), so the view toggle read as the thing to click.
    //
    // `radiogroup`, not two `aria-pressed` toggles. These are mutually exclusive —
    // one view is always on — and as toggles a screen reader announced both
    // independently ("Detailed, pressed" / "Compact, not pressed") with nothing
    // saying they are the same choice.
    // The track is `bg-muted` in light and `bg-background` in dark, and that swap
    // is the whole reason the control read as broken in dark mode. A segmented
    // control says "selected" by making the active chip the RAISED surface — but
    // every dark theme in `styles/themes.css` puts `--card` (≈11% lightness)
    // BELOW `--muted` (≈16%), so `bg-card` on a `bg-muted` track was a chip
    // darker than the thing it sits in: a hole, not a selection. Light mode hid
    // it, because there card is 100% against muted's 97%.
    // `bg-background` is under `--card` in every dark theme and over nothing in
    // light, so the chip is lighter than its track in both.
    <div
      role="radiogroup"
      aria-label="Recommendation list density"
      className="flex h-8 items-center gap-0.5 rounded-[var(--r-tile)] border border-transparent bg-muted p-0.5 dark:border-border/60 dark:bg-background"
    >
      {VIEW_MODES.map((mode) => (
        <button
          key={mode}
          type="button"
          role="radio"
          onClick={() => onChange(mode)}
          // 8px inside a 10px track with 2px of padding — concentric. It was 6px
          // inside `rounded-lg`, which is 16px under this theme's `--radius`, so
          // the chip's corners read square against a visibly rounder track.
          className={cn(
            'h-full rounded-[var(--r-control)] px-2.5 text-[11.5px] font-semibold capitalize transition',
            value === mode
              ? 'bg-card text-foreground shadow-elevated-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
          aria-checked={value === mode}
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
  const canWrite = !readOnly && user?.role === ROLES.ADMIN;
  const { data: intern } = useIntern(userId);
  const { data: positions = [] } = usePositions();
  const { data: projects = [] } = useProjects();
  const { data: technologies = [] } = useTechnologies();
  const {
    data,
    isPending: isPendingRaw,
    isError,
  } = useRecommendations({
    internUserId: userId,
    limit: 50,
  });
  // Global hold: keeps the mark up for MIN_VISIBLE_MS once it appears, and until the data is in.
  const isPending = useLoaderHold(isPendingRaw, { release: isError });
  const { mutate: createRecommendation, isPending: isCreating } = useCreateRecommendation();
  const { mutate: updateRecommendation, isPending: isUpdating } = useUpdateRecommendation();
  const { mutate: deleteRecommendation, isPending: isDeleting } = useDeleteRecommendation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailRecommendation, setDetailRecommendation] = useState(null);
  const [activeRecommendation, setActiveRecommendation] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [duplicateWarn, setDuplicateWarn] = useState(null);
  const [form, setForm] = useState(createEmptyForm);
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState('desc');
  const [viewMode, setViewMode] = useState(() =>
    readStoredPreference(VIEW_MODE_STORAGE_KEY, 'detailed', isViewMode)
  );

  const recommendations = data?.recommendations ?? [];
  const isSaving = isCreating || isUpdating;
  const isEditing = Boolean(activeRecommendation);
  // A result already recorded on the server. The backend can change a recorded
  // outcome but never remove it, so the form keeps the outcome visible even
  // when the status moves back off "resulted".
  const hasRecordedOutcome = Boolean(activeRecommendation?.result?.outcome);
  const recommendBlocked = isRecommendBlockedByProfileStatus(intern?.status);
  const internName = intern?.user?.fullname || 'This intern';

  const positionName = (recommendation) => recommendation?.position?.name || 'Position not set';

  const changeViewMode = (mode) => {
    if (!isViewMode(mode)) return;
    setViewMode(mode);
    writeStoredPreference(VIEW_MODE_STORAGE_KEY, mode);
  };

  // The edit form is seeded once from the record when the dialog opens
  // (handleEdit). We deliberately do NOT re-sync it from `recommendations` on
  // every refetch — doing so overwrote the user's in-progress edits mid-typing.

  const handleNew = () => {
    if (recommendBlocked) return;
    setActiveRecommendation(null);
    setForm(createEmptyForm());
    setDialogOpen(true);
  };

  const handleEdit = (recommendation) => {
    setActiveRecommendation(recommendation);
    setForm(formFromRecommendation(recommendation));
    setDialogOpen(true);
  };

  const buildPayload = () => {
    const payload = {
      internUserId: userId,
      positionId: form.positionId,
      // An explicit null asserts "not known yet" — never omitted, so the
      // server can tell a deliberate unknown from a dropped field.
      projectId: form.projectUnknown ? null : form.projectId,
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
        // Explicit null, not undefined: an emptied field means "we don't know
        // when they start yet", which the server must record as such rather than
        // leave the previous date standing. Only a placement carries one.
        startDate: form.resultOutcome === 'placed' ? form.startDate || null : null,
      };
    }

    return payload;
  };

  const savePayload = (payload) => {
    const options = {
      onSuccess: () => {
        toast.success(activeRecommendation ? 'Recommendation updated' : 'Recommendation created');
        setDialogOpen(false);
        setActiveRecommendation(null);
        setDuplicateWarn(null);
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

  const handleSubmit = () => {
    if (!isEditing && recommendBlocked) {
      toast.error(recommendBlockedReason(intern?.status));
      return;
    }
    if (!form.positionId) {
      toast.error('Select a position for this recommendation');
      return;
    }
    if (!form.projectUnknown && !form.projectId) {
      toast.error('Select a project, or mark it not known yet');
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
    // The placement start date is deliberately NOT checked against the stage
    // dates. It isn't a stage — an intern can have started on the project before
    // anyone got round to recording the placement, so a start date earlier than
    // the Resulted date is legitimate, not a mistake to block.

    const payload = buildPayload();

    // Soft warn when pitching someone who already has an open recommendation
    // on a different project — create is still allowed after confirm. Not
    // meaningful when the project isn't known yet, so there is nothing to
    // compare against.
    if (!isEditing && !form.projectUnknown) {
      const conflicts = activeRecommendationsOnOtherProjects(recommendations, form.projectId);
      if (conflicts.length > 0) {
        const targetProject =
          projects.find((project) => project._id === form.projectId)?.name || 'this project';
        const existingProjectNames = [
          ...new Set(conflicts.map((recommendation) => recommendationProjectName(recommendation))),
        ];
        setDuplicateWarn({ payload, existingProjectNames, targetProjectName: targetProject });
        return;
      }
    }

    savePayload(payload);
  };

  const handleDuplicateWarnConfirm = () => {
    if (!duplicateWarn?.payload || isCreating) return;
    savePayload(duplicateWarn.payload);
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
    <div className={cn('space-y-3.5 text-foreground', REC_FONT)}>
      <section className="app-card overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-separator px-[18px] py-3">
          <div className="min-w-0">
            <h2 className="app-card-title">Recommendations</h2>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">{subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SortControl
              sortKey={sortKey}
              sortDir={sortDir}
              options={SORT_OPTIONS}
              onSortKeyChange={handleSortKeyChange}
              onToggleDir={() => setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
              className="h-8 rounded-[var(--r-control)] border-input bg-card"
              triggerClassName="text-[12.5px]"
              dataTest="recommendation-history-sort"
            />
            <ViewModeSwitcher value={viewMode} onChange={changeViewMode} />
            {canWrite &&
              (recommendBlocked ? (
                // A portal-based tooltip, not `DarkTooltip`: this button sits at the top
                // of an `overflow-hidden` card, so a tooltip positioned above it (like
                // DarkTooltip's) has no room to render and gets clipped invisibly —
                // hovering showed nothing. Radix's renders into a portal, so it escapes
                // the card's clipping entirely.
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex">
                        <button
                          type="button"
                          disabled
                          aria-disabled="true"
                          className={cn(
                            'inline-flex h-8 items-center gap-1.5 rounded-[var(--r-control)] px-3 text-[12.5px] font-medium',
                            BTN_PRIMARY_CLASS,
                            BTN_PRIMARY_DISABLED_CLASS
                          )}
                          data-test="recommendation-history-new-button"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          New recommendation
                        </button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{recommendBlockedReason(intern?.status)}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <button
                  type="button"
                  onClick={handleNew}
                  className={cn(
                    'inline-flex h-8 items-center gap-1.5 rounded-[var(--r-control)] px-3 text-[12.5px] font-medium shadow-none',
                    BTN_PRIMARY_CLASS
                  )}
                  data-test="recommendation-history-new-button"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New recommendation
                </button>
              ))}
          </div>
        </header>

        <div>
          {isPending && (
            <LoadingOverlay size="sm" label="Loading recommendations">
              <PanelBodySkeleton rows={3} className="px-[18px] pb-5" />
            </LoadingOverlay>
          )}
          {!isPending && sorted.length === 0 && (
            <p className="px-[18px] py-10 text-center text-[12.5px] text-muted-foreground">
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
      </section>

      <RecommendationFormModal
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        isEditing={isEditing}
        form={form}
        setForm={setForm}
        statuses={RECOMMENDATION_STATUSES}
        positions={positions}
        projects={projects}
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

      <RecommendationDuplicateWarnDialog
        open={Boolean(duplicateWarn)}
        internName={internName}
        existingProjectNames={duplicateWarn?.existingProjectNames}
        targetProjectName={duplicateWarn?.targetProjectName}
        isSaving={isCreating}
        onCancel={() => setDuplicateWarn(null)}
        onConfirm={handleDuplicateWarnConfirm}
      />
    </div>
  );
}
