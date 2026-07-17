import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronsUpDown, Plus, Search, Trash2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AutoTextarea } from '@/components/ui/auto-textarea';
import { cn } from '@/lib/utils';
import { TechnologyIcon } from '@/helpers/technologyIcons';
import {
  getRecommendationResultLabel,
  getRecommendationStatusLabel,
  RECOMMENDATION_RESULTS,
} from '@/helpers/recommendations';
import {
  BTN_DANGER_CLASS,
  BTN_DANGER_GHOST_CLASS,
  BTN_PRIMARY_CLASS,
  BTN_PRIMARY_DISABLED_CLASS,
  BTN_SECONDARY_CLASS,
  CHIP_CLASS,
  FieldLabel,
  INPUT_CLASS,
  REC_FONT,
  RecModal,
  RecommendationTimeline,
  SectionLabel,
  STATUS_COLORS,
  StatusPill,
  StatusSegmented,
  formatRecDate,
} from './recommendationUi';

const SELECT_TRIGGER_CLASS =
  'h-auto w-full rounded-xl border-[#dcdfe9] bg-white px-[14px] py-[11px] text-[14px] text-[#171b2b] shadow-none focus:ring-0 focus:ring-offset-0 data-[placeholder]:text-[#9aa1b4]';

// How many chips render before collapsing behind a "+N more" toggle.
const VIEW_CHIP_LIMIT = 8;
const EDIT_CHIP_LIMIT = 4;

function RemovableChip({ technology, onRemove }) {
  return (
    <span className={cn(CHIP_CLASS, 'gap-1.5')}>
      <TechnologyIcon technology={technology} size={13} className="shrink-0" />
      {technology.name}
      <button
        type="button"
        onClick={onRemove}
        className="text-[#9aa1b4] transition hover:text-[#3c4257]"
        aria-label={`Remove ${technology.name}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

/**
 * Searchable technology multi-select. Intentionally an INLINE dropdown (not a
 * Radix Popover): this picker lives inside a Radix Dialog, and Radix's dialog
 * scroll-lock swallows wheel/touch scroll inside a portaled popover, so the
 * option list wouldn't scroll. Rendering the list in the dialog's own DOM flow
 * keeps native overflow scrolling working.
 *
 * Variants:
 * - "select" (create modal): input-like trigger with the selected chips
 *   wrapping below it.
 * - "box" (edit modal): bordered container holding the removable chips
 *   (collapsed behind "+N more" past 4) and an accent "+ Add technology".
 */
export function TechnologyMultiSelect({ technologies, selectedIds, onChange, variant = 'select' }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef(null);

  const selectedTechnologies = useMemo(
    () => technologies.filter((technology) => selectedIds.includes(technology._id)),
    [selectedIds, technologies]
  );

  // Only show technologies not already picked — selecting one removes it from
  // the pool; removal returns it to the pool.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return technologies.filter(
      (technology) =>
        !selectedIds.includes(technology._id) && (!q || technology.name.toLowerCase().includes(q))
    );
  }, [query, technologies, selectedIds]);

  const add = (technologyId) => {
    if (!selectedIds.includes(technologyId)) onChange([...selectedIds, technologyId]);
  };
  const remove = (technologyId) => onChange(selectedIds.filter((id) => id !== technologyId));

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        // Swallow the event so it only closes the dropdown — the surrounding
        // Radix Dialog also listens for Escape (capture, on document) and
        // would otherwise close the whole form, losing everything typed.
        // window-capture runs before document-capture, so this wins.
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open]);

  const dropdown = open && (
    <div className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-[#dcdfe9] bg-white shadow-[0_12px_32px_rgba(20,24,40,.14)]">
      <div className="flex items-center gap-2 border-b border-[#eef0f5] px-3">
        <Search className="h-4 w-4 shrink-0 text-[#9aa1b4]" />
        {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search technologies…"
          className="h-10 w-full bg-transparent text-[14px] text-[#171b2b] outline-none placeholder:text-[#9aa1b4]"
          data-test="recommendation-technology-search"
        />
      </div>
      <div className="max-h-[240px] overflow-y-auto overscroll-contain p-1">
        {filtered.length === 0 && (
          <p className="px-3 py-6 text-center text-[13.5px] text-[#8b91a5]">
            {selectedIds.length === technologies.length
              ? 'All technologies added.'
              : 'No technologies found.'}
          </p>
        )}
        {filtered.map((technology) => (
          <button
            key={technology._id}
            type="button"
            onClick={() => add(technology._id)}
            className="flex w-full items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-left text-[14px] text-[#33384c] transition hover:bg-[#f2f3f8]"
            data-test={`recommendation-technology-option-${technology.slug}`}
          >
            <TechnologyIcon technology={technology} size={16} className="shrink-0" />
            <span className="flex-1 truncate">{technology.name}</span>
            <Plus className="h-4 w-4 shrink-0 text-[#9aa1b4]" />
          </button>
        ))}
      </div>
    </div>
  );

  if (variant === 'box') {
    const visible = expanded
      ? selectedTechnologies
      : selectedTechnologies.slice(0, EDIT_CHIP_LIMIT);
    const hiddenCount = selectedTechnologies.length - visible.length;
    return (
      <div ref={containerRef} className="relative">
        <div className="rounded-xl border border-[#dcdfe9] px-[14px] py-3">
          <div className="flex flex-wrap items-center gap-2">
            {visible.map((technology) => (
              <RemovableChip
                key={technology._id}
                technology={technology}
                onRemove={() => remove(technology._id)}
              />
            ))}
            {hiddenCount > 0 && (
              <button type="button" onClick={() => setExpanded(true)} className={CHIP_CLASS}>
                +{hiddenCount} more
              </button>
            )}
            {selectedTechnologies.length === 0 && (
              <span className="text-[13.5px] text-[#9aa1b4]">No technologies selected.</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            className="mt-2.5 inline-flex items-center gap-1 text-[13.5px] font-semibold text-[#6d5ce6] transition hover:text-[#5a48d6]"
            data-test="recommendation-technology-select"
          >
            <Plus className="h-3.5 w-3.5" />
            Add technology
          </button>
        </div>
        {dropdown}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(INPUT_CLASS, 'flex items-center justify-between text-left text-[#9aa1b4]')}
        data-test="recommendation-technology-select"
      >
        Select technologies…
        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-60" />
      </button>
      {dropdown}
      {selectedTechnologies.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {selectedTechnologies.map((technology) => (
            <RemovableChip
              key={technology._id}
              technology={technology}
              onRemove={() => remove(technology._id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Read-only chips list, collapsed behind "+N more" past 8 (view modal). */
function ViewChips({ technologies }) {
  const [expanded, setExpanded] = useState(false);
  if (!technologies.length) {
    return <span className="text-[13.5px] text-[#8b91a5]">None selected.</span>;
  }
  const visible = expanded ? technologies : technologies.slice(0, VIEW_CHIP_LIMIT);
  const hiddenCount = technologies.length - visible.length;
  return (
    <div className="flex flex-wrap gap-2">
      {visible.map((technology) => (
        <span key={technology._id} className={cn(CHIP_CLASS, 'gap-1.5')}>
          <TechnologyIcon technology={technology} size={13} className="shrink-0" />
          {technology.name}
        </span>
      ))}
      {hiddenCount > 0 && (
        <button type="button" onClick={() => setExpanded(true)} className={CHIP_CLASS}>
          +{hiddenCount} more
        </button>
      )}
    </div>
  );
}

/**
 * Read-only view modal: status strip + pill, timeline with CURRENT tag,
 * technologies, note and the placement-outcome card. Leadership (readOnly)
 * gets no Delete / Edit actions.
 */
export function RecommendationViewModal({
  recommendation,
  steps,
  positionName,
  canWrite,
  onClose,
  onEdit,
  onDelete,
}) {
  if (!recommendation) return null;

  return (
    <RecModal
      open
      onClose={onClose}
      dataTest="intern-recommendation-detail-dialog"
      strip={STATUS_COLORS[recommendation.status] || STATUS_COLORS.recommended}
      title={positionName}
      titleClassName="text-[22px]"
      titleAside={
        <StatusPill
          status={recommendation.status}
          label={getRecommendationStatusLabel(recommendation.status)}
        />
      }
      subtitle={
        <>
          Project <span className="font-semibold text-[#33384c]">{recommendation.project}</span> ·
          Updated {formatRecDate(recommendation.updatedAt)} by{' '}
          {recommendation.updatedBy?.fullname || 'Unknown'}
        </>
      }
      footer={
        <>
          {canWrite && (
            <button type="button" onClick={onDelete} className={BTN_DANGER_GHOST_CLASS}>
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          )}
          <div className="ml-auto flex items-center gap-3">
            <button type="button" onClick={onClose} className={BTN_SECONDARY_CLASS}>
              Close
            </button>
            {canWrite && (
              <button type="button" onClick={onEdit} className={BTN_PRIMARY_CLASS}>
                Edit recommendation
              </button>
            )}
          </div>
        </>
      }
    >
      <div>
        <SectionLabel className="mb-4">Status timeline</SectionLabel>
        <RecommendationTimeline steps={steps} size="modal" showCurrentTag />
      </div>

      <div>
        <SectionLabel className="mb-3">Technologies</SectionLabel>
        <ViewChips technologies={recommendation.technologies || []} />
      </div>

      {recommendation.recommendationNote && (
        <div>
          <SectionLabel className="mb-2">Note</SectionLabel>
          <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-[#5b6175] [overflow-wrap:anywhere]">
            {recommendation.recommendationNote}
          </p>
        </div>
      )}

      {recommendation.result?.outcome && (
        <div className="rounded-[14px] border border-[#e7e9ef] bg-[#fafbfd] px-5 py-4">
          <SectionLabel className="mb-2">Placement outcome</SectionLabel>
          <p className="text-[14px] text-[#8b91a5]">
            <span className="text-[15px] font-bold text-[#171b2b]">
              {getRecommendationResultLabel(recommendation.result.outcome)}
            </span>{' '}
            · {formatRecDate(recommendation.result.decidedAt)} by{' '}
            {recommendation.result.decidedBy?.fullname || 'Unknown'}
          </p>
          {recommendation.result.note && (
            <p className="mt-1 text-[13.5px] text-[#5b6175] [overflow-wrap:anywhere]">
              {recommendation.result.note}
            </p>
          )}
        </div>
      )}
    </RecModal>
  );
}

/**
 * Create + edit modal. Create is fixed at Recommended (later stages are locked);
 * edit unlocks forward moves, per-stage dates (persisted as statusDates, with
 * interviewing skippable) and the placement outcome once the status is Resulted.
 */
export function RecommendationFormModal({
  open,
  onClose,
  isEditing,
  form,
  setForm,
  statuses,
  positions,
  technologies,
  activeRecommendation,
  hasRecordedOutcome,
  positionName,
  todayInputDate,
  isSaving,
  onSubmit,
  onDelete,
}) {
  const statusKeys = statuses.map((status) => status.value);
  const savedIndex = isEditing
    ? Math.max(0, statusKeys.indexOf(activeRecommendation?.status ?? 'recommended'))
    : 0;
  // Completed (earlier) stages are locked when editing; a new recommendation
  // can only start at Recommended.
  const lockedValues = isEditing ? statusKeys.slice(0, savedIndex) : statusKeys.slice(1);
  const formIndex = Math.max(0, statusKeys.indexOf(form.status));

  // Moving the status forward defaults each newly reached stage's date to
  // today; jumping Recommended → Resulted with no Interviewing date marks
  // Interviewing as Skipped automatically.
  const handleStatusChange = (status) => {
    setForm((prev) => {
      const nextIndex = statusKeys.indexOf(status);
      const statusDates = { ...prev.statusDates };
      let interviewingSkipped = prev.interviewingSkipped;
      if (!statusDates.recommended) statusDates.recommended = todayInputDate();
      if (status === 'interviewing') {
        interviewingSkipped = false;
        if (!statusDates.interviewing) statusDates.interviewing = todayInputDate();
      }
      if (status === 'resulted') {
        if (!statusDates.resulted) statusDates.resulted = todayInputDate();
        if (!statusDates.interviewing) interviewingSkipped = true;
      }
      if (nextIndex < statusKeys.indexOf('resulted')) {
        // Falling back below Resulted keeps the dates; they just stop being
        // "reached" and render disabled.
      }
      return { ...prev, status, statusDates, interviewingSkipped };
    });
  };

  const handleStageDateChange = (stageKey, value) => {
    setForm((prev) => ({
      ...prev,
      statusDates: { ...prev.statusDates, [stageKey]: value },
    }));
  };

  const showOutcomeSection = isEditing && (form.status === 'resulted' || hasRecordedOutcome);
  // Saving a Resulted recommendation requires a concrete placement result;
  // while "--" is selected the primary action stays disabled.
  const outcomeMissing = isEditing && form.status === 'resulted' && form.resultOutcome === 'none';
  const submitDisabled = isSaving || outcomeMissing;

  const submitLabel = isSaving
    ? 'Saving...'
    : isEditing
      ? 'Update recommendation'
      : 'Create recommendation';

  return (
    <RecModal
      open={open}
      onClose={onClose}
      onSubmit={onSubmit}
      title={isEditing ? 'Edit recommendation' : 'New recommendation'}
      subtitle={
        isEditing
          ? `${positionName(activeRecommendation)} · ${activeRecommendation?.project || '—'}`
          : 'Available to Mentor and Admin roles · visible to Leadership'
      }
      footer={
        <>
          {isEditing && (
            <button type="button" onClick={onDelete} className={BTN_DANGER_GHOST_CLASS}>
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          )}
          <div className="ml-auto flex items-center gap-3">
            <button type="button" onClick={onClose} className={BTN_SECONDARY_CLASS}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitDisabled}
              className={cn(BTN_PRIMARY_CLASS, submitDisabled && BTN_PRIMARY_DISABLED_CLASS)}
              data-test="recommendation-submit-button"
            >
              {submitLabel}
            </button>
          </div>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor="recommendation-position" required className="mb-2">
            Position
          </FieldLabel>
          <Select
            value={form.positionId}
            onValueChange={(positionId) => setForm((prev) => ({ ...prev, positionId }))}
          >
            <SelectTrigger
              id="recommendation-position"
              className={SELECT_TRIGGER_CLASS}
              data-test="recommendation-position-select"
            >
              <SelectValue placeholder="Select a position" />
            </SelectTrigger>
            <SelectContent>
              {positions.map((position) => (
                <SelectItem key={position._id} value={position._id}>
                  {position.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <FieldLabel htmlFor="recommendation-project" required className="mb-2">
            Project
          </FieldLabel>
          <input
            id="recommendation-project"
            value={form.project}
            onChange={(event) => setForm((prev) => ({ ...prev, project: event.target.value }))}
            placeholder="e.g. Mentor E2E"
            maxLength={200}
            className={INPUT_CLASS}
            data-test="recommendation-project-input"
          />
        </div>
      </div>

      <div>
        <FieldLabel className="mb-2">Status</FieldLabel>
        <StatusSegmented
          statuses={statuses}
          value={form.status}
          onChange={handleStatusChange}
          lockedValues={lockedValues}
          lockedHint={
            isEditing
              ? "Completed stages can't be re-selected"
              : 'A new recommendation starts at Recommended'
          }
        />
        {!isEditing && (
          <p className="mt-2.5 flex items-center gap-2 text-[12.5px] text-[#8b91a5]">
            <span
              className="h-[5px] w-[5px] shrink-0 rounded-full bg-[#c3c8d8]"
              aria-hidden="true"
            />
            A new recommendation starts at Recommended — later stages are set by updating it.
          </p>
        )}
      </div>

      {isEditing ? (
        <div>
          <FieldLabel className="mb-2.5">Status dates</FieldLabel>
          <div className="grid grid-cols-3 gap-4">
            {statuses.map((status, index) => {
              const reached =
                index <= formIndex &&
                !(status.value === 'interviewing' && form.interviewingSkipped);
              const disabled = !reached;
              // Later stages can't be dated before earlier ones (also enforced
              // on submit and by the server).
              const minDate =
                status.value === 'interviewing'
                  ? form.statusDates.recommended || undefined
                  : status.value === 'resulted'
                    ? (!form.interviewingSkipped && form.statusDates.interviewing) ||
                      form.statusDates.recommended ||
                      undefined
                    : undefined;
              return (
                <div key={status.value}>
                  <SectionLabel className="mb-1.5">{status.label}</SectionLabel>
                  <input
                    type="date"
                    value={form.statusDates[status.value] || ''}
                    disabled={disabled}
                    min={minDate}
                    onChange={(event) => handleStageDateChange(status.value, event.target.value)}
                    className={cn(
                      INPUT_CLASS,
                      disabled && 'cursor-not-allowed bg-[#f6f7fa] text-[#b0b5c6]'
                    )}
                    data-test={`recommendation-date-${status.value}`}
                  />
                </div>
              );
            })}
          </div>
          <p className="mt-2.5 text-[12.5px] leading-relaxed text-[#8b91a5]">
            Defaults to today when a stage is reached — adjust if it happened earlier. Skipped
            stages show as &quot;Skipped&quot; on the timeline.
          </p>
        </div>
      ) : (
        <div>
          <FieldLabel htmlFor="recommendation-recommended-date" className="mb-2">
            Recommended date
          </FieldLabel>
          <div className="grid gap-4 sm:grid-cols-2">
            <input
              id="recommendation-recommended-date"
              type="date"
              value={form.statusDates.recommended || ''}
              onChange={(event) => handleStageDateChange('recommended', event.target.value)}
              className={INPUT_CLASS}
              data-test="recommendation-date-recommended"
            />
          </div>
          <p className="mt-2 text-[12.5px] text-[#8b91a5]">
            Defaults to today — change if it happened earlier.
          </p>
        </div>
      )}

      <div>
        <FieldLabel className="mb-2">Technologies</FieldLabel>
        <TechnologyMultiSelect
          technologies={technologies}
          selectedIds={form.technologyIds}
          onChange={(technologyIds) => setForm((prev) => ({ ...prev, technologyIds }))}
          variant={isEditing ? 'box' : 'select'}
        />
      </div>

      <div>
        <FieldLabel htmlFor="recommendation-note" className="mb-2">
          Recommendation note
        </FieldLabel>
        <AutoTextarea
          id="recommendation-note"
          value={form.recommendationNote}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, recommendationNote: event.target.value }))
          }
          rows={3}
          placeholder="Why is this intern a good fit?"
          className={cn(INPUT_CLASS, 'min-h-[88px]')}
          data-test="recommendation-note-input"
        />
      </div>

      {showOutcomeSection && (
        <div className="rounded-[14px] border border-[#e7e9ef] bg-[#fafbfd] px-5 py-[18px]">
          <SectionLabel className="mb-3.5">Placement outcome</SectionLabel>
          {form.status === 'resulted' ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel required className="mb-2">
                    Placement result
                  </FieldLabel>
                  <Select
                    value={form.resultOutcome}
                    onValueChange={(resultOutcome) =>
                      setForm((prev) => ({ ...prev, resultOutcome }))
                    }
                  >
                    <SelectTrigger
                      className={SELECT_TRIGGER_CLASS}
                      data-test="recommendation-result-select"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">--</SelectItem>
                      {RECOMMENDATION_RESULTS.map((result) => (
                        <SelectItem key={result.value} value={result.value}>
                          {result.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <FieldLabel htmlFor="recommendation-result-note" className="mb-2">
                    Result note
                  </FieldLabel>
                  <input
                    id="recommendation-result-note"
                    value={form.resultNote}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, resultNote: event.target.value }))
                    }
                    placeholder="Notes on the result…"
                    className={INPUT_CLASS}
                    data-test="recommendation-result-note-input"
                  />
                </div>
              </div>
              <p className="mt-3 text-[12.5px] leading-relaxed text-[#8b91a5]">
                Select &quot;Placed&quot; or &quot;Not placed&quot; to enable saving. &quot;Not
                placed&quot; marks the intern as ready for a new placement.
              </p>
            </>
          ) : (
            // Status was moved back while a result is already recorded. The
            // server keeps the result, so show it instead of hiding it.
            <div data-test="recommendation-stale-result-notice">
              <p className="text-[14px] font-semibold text-[#171b2b]">
                {getRecommendationResultLabel(activeRecommendation.result.outcome)} — kept
              </p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-[#8b91a5]">
                This recommendation already has a recorded result. Moving the status back does not
                clear it — set the status to Resulted to change the outcome.
              </p>
            </div>
          )}
        </div>
      )}
    </RecModal>
  );
}

/** 430px destructive-action confirmation for deleting a recommendation. */
export function RecommendationDeleteDialog({
  recommendation,
  positionName,
  isDeleting = false,
  onCancel,
  onConfirm,
}) {
  if (!recommendation) return null;
  return (
    <Dialog open onOpenChange={(next) => !next && onCancel()}>
      <DialogContent
        hideCloseButton
        className={cn(
          'block max-w-[430px] gap-0 rounded-[20px] border-0 bg-white p-7 shadow-[0_24px_60px_rgba(20,24,40,.18)] sm:rounded-[20px] sm:p-7',
          REC_FONT
        )}
        data-test="recommendation-delete-dialog"
      >
        <div className="grid h-11 w-11 place-items-center rounded-full bg-[#fdeaea]">
          <Trash2 className="h-5 w-5 text-[#d64c4c]" />
        </div>
        <DialogTitle className="mt-4 text-[18px] font-bold text-[#171b2b]">
          Delete recommendation?
        </DialogTitle>
        <DialogDescription className="mt-2 text-[13.5px] leading-relaxed text-[#5b6175]">
          Are you sure you want to delete{' '}
          <span className="font-bold text-[#171b2b]">
            &quot;{positionName(recommendation)} · {recommendation.project}&quot;
          </span>
          ? The full status history and placement outcome will be removed. This can&apos;t be
          undone.
        </DialogDescription>
        {recommendation.result?.outcome === 'placed' && (
          <p
            className="mt-3 rounded-[10px] bg-[#fef4e2] px-3 py-2.5 text-[12.5px] font-medium leading-relaxed text-[#b06a05]"
            data-test="recommendation-delete-placed-warning"
          >
            This recommendation marked the intern as Placed — deleting it will set them back to
            Ready for a new placement.
          </p>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className={BTN_SECONDARY_CLASS}>
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className={cn(BTN_DANGER_CLASS, isDeleting && 'cursor-not-allowed opacity-60')}
            data-test="recommendation-delete-confirm-button"
          >
            {isDeleting ? 'Deleting…' : 'Delete recommendation'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
