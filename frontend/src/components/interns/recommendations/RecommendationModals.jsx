import { useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
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
import {
  TechnologyMultiSelect,
  TechnologyViewChips,
} from '@/components/ui/technology-multi-select';
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
  'h-auto w-full rounded-xl border-input bg-card px-[14px] py-[11px] text-[14px] text-foreground shadow-none focus:ring-0 focus:ring-offset-0 data-[placeholder]:text-muted-foreground/80';

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
          Project{' '}
          <span className="font-semibold text-foreground/90">
            {recommendation.project?.name || '—'}
          </span>{' '}
          · Updated {formatRecDate(recommendation.updatedAt)} by{' '}
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
        <TechnologyViewChips
          technologies={recommendation.technologies || []}
          chipClassName={CHIP_CLASS}
        />
      </div>

      {recommendation.recommendationNote && (
        <div>
          <SectionLabel className="mb-2">Note</SectionLabel>
          <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
            {recommendation.recommendationNote}
          </p>
        </div>
      )}

      {recommendation.result?.outcome && (
        <div className="rounded-[14px] border border-border bg-muted/30 px-5 py-4">
          <SectionLabel className="mb-2">Placement outcome</SectionLabel>
          <p className="text-[14px] text-muted-foreground">
            <span className="text-[15px] font-bold text-foreground">
              {getRecommendationResultLabel(recommendation.result.outcome)}
            </span>{' '}
            · {formatRecDate(recommendation.result.decidedAt)} by{' '}
            {recommendation.result.decidedBy?.fullname || 'Unknown'}
          </p>
          {recommendation.result.outcome === 'placed' && (
            <p
              className="mt-1 text-[13.5px] text-muted-foreground"
              data-test="placement-start-date"
            >
              {recommendation.result.startDate ? (
                <>Starts {formatRecDate(recommendation.result.startDate)}</>
              ) : (
                <>Start date not set — still counted in attendance</>
              )}
            </p>
          )}
          {recommendation.result.note && (
            <p className="mt-1 text-[13.5px] text-muted-foreground [overflow-wrap:anywhere]">
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
  projects,
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

  // The picker only offers active, non-system projects. If the recommendation
  // being edited already points at one that's now on-hold/completed (or the
  // "Unspecified" sentinel), keep it selected and flag it so it isn't
  // silently swapped out from under the mentor.
  const currentProject = activeRecommendation?.project;
  const projectOptions =
    isEditing && currentProject && !projects.some((project) => project._id === currentProject._id)
      ? [{ ...currentProject, _inactive: true }, ...projects]
      : projects;

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
  // A start date belongs to a placement and nothing else, so the field is shown
  // but inert until the outcome says Placed.
  const placementStartDisabled = form.resultOutcome !== 'placed';
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
          ? `${positionName(activeRecommendation)} · ${activeRecommendation?.project?.name || '—'}`
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
          <Select
            value={form.projectId}
            onValueChange={(projectId) => setForm((prev) => ({ ...prev, projectId }))}
          >
            <SelectTrigger
              id="recommendation-project"
              className={SELECT_TRIGGER_CLASS}
              data-test="recommendation-project-select"
            >
              <SelectValue placeholder="Select a project" />
            </SelectTrigger>
            <SelectContent>
              {projectOptions.map((project) => (
                <SelectItem key={project._id} value={project._id}>
                  {project.name}
                  {project._inactive ? ' (inactive)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          <p className="mt-2.5 flex items-center gap-2 text-[12.5px] text-muted-foreground">
            <span
              className="h-[5px] w-[5px] shrink-0 rounded-full bg-muted-foreground/40"
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
                      disabled && 'cursor-not-allowed bg-muted/40 text-muted-foreground/70'
                    )}
                    data-test={`recommendation-date-${status.value}`}
                  />
                </div>
              );
            })}
          </div>
          <p className="mt-2.5 text-[12.5px] leading-relaxed text-muted-foreground">
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
          <p className="mt-2 text-[12.5px] text-muted-foreground">
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
          triggerClassName={cn(
            INPUT_CLASS,
            'flex items-center justify-between text-left text-muted-foreground/80'
          )}
          chipClassName={CHIP_CLASS}
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
        <div className="rounded-[14px] border border-border bg-muted/30 px-5 py-[18px]">
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
                      setForm((prev) => ({
                        ...prev,
                        resultOutcome,
                        // Choosing "Placed" offers the Resulted date as the start
                        // date, since starting straight away is the common case.
                        // Only fills a blank field — a date already typed, or one
                        // cleared on purpose while the picker stays on Placed, is
                        // left alone.
                        startDate:
                          resultOutcome === 'placed' && !prev.startDate
                            ? prev.statusDates.resulted || todayInputDate()
                            : prev.startDate,
                      }))
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
              {/* Always on show once the status is Resulted, disabled until the
                  outcome is Placed — the same idiom as the unreached status-date
                  inputs above. Rendering it only for a placement made the field
                  impossible to find: you had to already know it would appear. */}
              <div className="mt-4">
                <FieldLabel htmlFor="recommendation-start-date" className="mb-2">
                  Start date
                </FieldLabel>
                <div className="grid items-center gap-4 sm:grid-cols-2">
                  <input
                    id="recommendation-start-date"
                    type="date"
                    value={placementStartDisabled ? '' : form.startDate || ''}
                    disabled={placementStartDisabled}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, startDate: event.target.value }))
                    }
                    className={cn(
                      INPUT_CLASS,
                      placementStartDisabled &&
                        'cursor-not-allowed bg-muted/40 text-muted-foreground/70'
                    )}
                    data-test="recommendation-start-date"
                  />
                  {!placementStartDisabled && form.startDate && (
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, startDate: '' }))}
                      className="justify-self-start text-[12.5px] font-semibold text-primary transition hover:text-primary/80"
                      data-test="recommendation-start-date-clear"
                    >
                      Not known yet
                    </button>
                  )}
                </div>
                <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
                  {placementStartDisabled
                    ? 'Only a placement has a start date — choose “Placed” to set one.'
                    : form.startDate
                      ? 'The intern’s first day on the project — attendance stops counting from this day. Defaults to the Resulted date; edit it whenever the date moves.'
                      : 'Not set. The intern stays on the programme and keeps owing attendance until a start date is entered — come back and set it once it’s known.'}
                </p>
              </div>
              <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">
                Select &quot;Placed&quot; or &quot;Not placed&quot; to enable saving. &quot;Not
                placed&quot; marks the intern as ready for a new placement.
              </p>
            </>
          ) : (
            // Status was moved back while a result is already recorded. The
            // server keeps the result, so show it instead of hiding it.
            <div data-test="recommendation-stale-result-notice">
              <p className="text-[14px] font-semibold text-foreground">
                {getRecommendationResultLabel(activeRecommendation.result.outcome)} — kept
              </p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
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
          'block max-w-[430px] gap-0 rounded-[20px] border-0 bg-card p-7 shadow-elevated sm:rounded-[20px] sm:p-7',
          REC_FONT
        )}
        data-test="recommendation-delete-dialog"
      >
        <div className="grid h-11 w-11 place-items-center rounded-full bg-destructive/10">
          <Trash2 className="h-5 w-5 text-destructive" />
        </div>
        <DialogTitle className="mt-4 text-[18px] font-bold text-foreground">
          Delete recommendation?
        </DialogTitle>
        <DialogDescription className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
          Are you sure you want to delete{' '}
          <span className="font-bold text-foreground">
            &quot;{positionName(recommendation)} · {recommendation.project?.name || '—'}&quot;
          </span>
          ? The full status history and placement outcome will be removed. This can&apos;t be
          undone.
        </DialogDescription>
        {recommendation.result?.outcome === 'placed' && (
          <p
            className="mt-3 rounded-[10px] bg-amber-50 dark:bg-amber-500/15 px-3 py-2.5 text-[12.5px] font-medium leading-relaxed text-amber-700 dark:text-amber-300"
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

/**
 * Confirm before pitching an intern who already has an open recommendation on
 * another project. Soft warning only — create is still allowed after confirm.
 */
export function RecommendationDuplicateWarnDialog({
  open,
  internName,
  existingProjectNames = [],
  targetProjectName,
  isSaving = false,
  onCancel,
  onConfirm,
}) {
  if (!open) return null;

  const name = internName || 'This intern';
  const existingLabel =
    existingProjectNames.length === 0
      ? 'another project'
      : existingProjectNames.length === 1
        ? existingProjectNames[0]
        : `${existingProjectNames.slice(0, -1).join(', ')} and ${existingProjectNames.at(-1)}`;
  const targetLabel = targetProjectName || 'another project';

  return (
    <Dialog open onOpenChange={(next) => !next && onCancel()}>
      <DialogContent
        hideCloseButton
        className={cn(
          'block max-w-[460px] gap-0 rounded-[20px] border-0 bg-card p-7 shadow-elevated sm:rounded-[20px] sm:p-7',
          REC_FONT
        )}
        data-test="recommendation-duplicate-warn-dialog"
      >
        <div className="grid h-11 w-11 place-items-center rounded-full bg-amber-50 dark:bg-amber-500/15">
          <AlertTriangle className="h-5 w-5 text-amber-700 dark:text-amber-300" />
        </div>
        <DialogTitle className="mt-4 text-[18px] font-bold text-foreground">
          Already recommended elsewhere
        </DialogTitle>
        <DialogDescription className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
          <span className="font-bold text-foreground">{name}</span> is already recommended on{' '}
          <span className="font-bold text-foreground">{existingLabel}</span>. Are you sure you want
          to recommend them on <span className="font-bold text-foreground">{targetLabel}</span> as
          well?
        </DialogDescription>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className={BTN_SECONDARY_CLASS}
            data-test="recommendation-duplicate-warn-cancel-button"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSaving}
            className={cn(BTN_PRIMARY_CLASS, isSaving && BTN_PRIMARY_DISABLED_CLASS)}
            data-test="recommendation-duplicate-warn-confirm-button"
          >
            {isSaving ? 'Saving…' : 'Recommend anyway'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
