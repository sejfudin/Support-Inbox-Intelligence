import { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { ChevronsUpDown, Plus, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AutoTextarea } from '@/components/ui/auto-textarea';
import { HistoryPanel } from '@/components/interns/HistoryPanel';
import { DetailModal, DetailText, TAG_TONE } from '@/components/interns/DetailModal';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { canWriteInternMentorData } from '@/helpers/roles';
import { TechnologyIcon } from '@/helpers/technologyIcons';
import {
  getRecommendationResultLabel,
  getRecommendationStatusLabel,
  RECOMMENDATION_RESULTS,
  RECOMMENDATION_STATUSES,
} from '@/helpers/recommendations';
import { usePositions } from '@/queries/positions';
import { useTechnologies } from '@/queries/technologies';
import {
  useCreateRecommendation,
  useRecommendations,
  useUpdateRecommendation,
} from '@/queries/recommendations';

const createEmptyForm = () => ({
  positionId: '',
  project: '',
  technologyIds: [],
  recommendationNote: '',
  status: 'recommended',
  resultOutcome: 'none',
  resultNote: '',
});

const formatDate = (date) => {
  if (!date) return 'No date';
  return format(new Date(date), 'MMM d, yyyy');
};

const formFromRecommendation = (recommendation) => ({
  positionId: recommendation.position?._id || recommendation.position || '',
  project: recommendation.project || '',
  technologyIds: (recommendation.technologies || []).map((technology) => technology._id),
  recommendationNote: recommendation.recommendationNote || '',
  status: recommendation.status || 'recommended',
  resultOutcome: recommendation.result?.outcome || 'none',
  resultNote: recommendation.result?.note || '',
});

// Searchable multi-select for technologies. Intentionally an INLINE dropdown
// (not a Radix Popover): this picker lives inside a Radix Dialog, and Radix's
// dialog scroll-lock swallows wheel/touch scroll inside a portaled popover, so
// the option list wouldn't scroll. Rendering the list in the dialog's own DOM
// flow keeps native overflow scrolling working. Selected chips sit above so
// they stay visible while the (downward) list is open.
function TechnologyPicker({ technologies, selectedIds, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef(null);

  const selectedTechnologies = useMemo(
    () => technologies.filter((technology) => selectedIds.includes(technology._id)),
    [selectedIds, technologies]
  );

  // Only show technologies not already picked — selecting one removes it from
  // the pool (it moves to the chips above); removal returns it to the pool.
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
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="space-y-2">
      <Label>Technologies</Label>
      {/* Selected chips sit ABOVE the picker so they stay visible while the
          dropdown (which opens downward) is open. */}
      <div className="flex min-h-6 flex-wrap gap-2">
        {selectedTechnologies.map((technology) => (
          <Badge key={technology._id} variant="outline" className="gap-1.5 pl-2">
            <TechnologyIcon technology={technology} size={13} className="shrink-0" />
            {technology.name}
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => onChange(selectedIds.filter((id) => id !== technology._id))}
              aria-label={`Remove ${technology.name}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        {selectedTechnologies.length === 0 && (
          <span className="text-sm text-muted-foreground">No technologies selected.</span>
        )}
      </div>

      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-sm text-muted-foreground transition hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-test="recommendation-technology-select"
        >
          {selectedIds.length > 0 ? `${selectedIds.length} selected` : 'Search technologies…'}
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-60" />
        </button>

        {open && (
          <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md">
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search technologies…"
                className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                data-test="recommendation-technology-search"
              />
            </div>
            <div className="max-h-[240px] overflow-y-auto overscroll-contain p-1">
              {filtered.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
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
                  className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition hover:bg-muted"
                  data-test={`recommendation-technology-option-${technology.slug}`}
                >
                  <TechnologyIcon technology={technology} size={16} className="shrink-0" />
                  <span className="flex-1 truncate">{technology.name}</span>
                  <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Segmented control for the (now 3) recommendation statuses — cleaner than a
// dropdown for a small, fixed option set and keeps every choice visible.
function StatusSegmented({ value, onChange }) {
  return (
    <div
      className="grid grid-cols-3 gap-1 rounded-xl border border-input bg-muted/40 p-1"
      role="radiogroup"
      aria-label="Status"
      data-test="recommendation-status-select"
    >
      {RECOMMENDATION_STATUSES.map((status) => {
        const active = value === status.value;
        return (
          <button
            key={status.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(status.value)}
            className={cn(
              'rounded-lg px-3 py-2 text-sm font-semibold transition',
              active
                ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/30'
                : 'text-muted-foreground hover:text-foreground'
            )}
            data-test={`recommendation-status-option-${status.value}`}
          >
            {status.label}
          </button>
        );
      })}
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

  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailRecommendation, setDetailRecommendation] = useState(null);
  const [activeRecommendation, setActiveRecommendation] = useState(null);
  const [form, setForm] = useState(createEmptyForm);

  const recommendations = data?.recommendations ?? [];
  const isSaving = isCreating || isUpdating;
  const isEditing = Boolean(activeRecommendation);

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

  // DetailModal's <form> already calls preventDefault and invokes onSubmit()
  // with no arguments, so this handler must not expect an event.
  const handleSubmit = () => {
    if (!form.positionId) {
      toast.error('Select a position for this recommendation');
      return;
    }
    if (!form.project.trim()) {
      toast.error('Enter the project for this recommendation');
      return;
    }

    const payload = {
      internUserId: userId,
      positionId: form.positionId,
      project: form.project.trim(),
      technologyIds: form.technologyIds,
      recommendationNote: form.recommendationNote,
      status: form.status,
    };

    if (activeRecommendation && form.resultOutcome !== 'none') {
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

  const statusTagColor = (status) => {
    if (status === 'resulted') return 'green';
    return 'indigo';
  };
  const positionName = (recommendation) => recommendation.position?.name || 'Position not set';
  const resultTitle = (recommendation) =>
    recommendation.result?.outcome
      ? getRecommendationResultLabel(recommendation.result.outcome)
      : 'No result yet';

  const ordered = [...recommendations].sort(
    (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
  );

  const cards = ordered.map((recommendation, index) => ({
    id: recommendation._id,
    raw: recommendation,
    featured: index === 0,
    tag: {
      label: getRecommendationStatusLabel(recommendation.status),
      color: statusTagColor(recommendation.status),
    },
    // The position being recommended is now the headline of each card; the
    // placement result moves into a labelled pill alongside project.
    title: positionName(recommendation),
    metaSub: `Updated ${formatDate(recommendation.updatedAt)} · ${
      recommendation.updatedBy?.fullname || 'Unknown'
    }`,
    blocks: [
      {
        kind: 'text',
        label: 'Project',
        value: recommendation.project,
      },
      {
        kind: 'chips',
        label: 'Technologies',
        items: (recommendation.technologies || []).map((technology) => ({
          label: technology.name,
          icon: <TechnologyIcon technology={technology} size={13} className="shrink-0" />,
        })),
      },
      {
        kind: 'pill',
        label: 'Result',
        value: resultTitle(recommendation),
        color: recommendation.result?.outcome === 'placed' ? 'green' : 'slate',
      },
    ],
    note: recommendation.recommendationNote,
    sortVals: {
      updated: new Date(recommendation.updatedAt).getTime(),
      status: getRecommendationStatusLabel(recommendation.status),
      position: positionName(recommendation),
    },
  }));

  const subtitle = `${cards.length} recommendation${cards.length === 1 ? '' : 's'}`;

  return (
    <div className="space-y-6">
      <HistoryPanel
        title="Recommendation history"
        subtitle={subtitle}
        buttonLabel="New recommendation"
        canWrite={canWrite}
        isLoading={isPending}
        cards={cards}
        sortOptions={[
          { key: 'updated', label: 'Updated' },
          { key: 'status', label: 'Status' },
          { key: 'position', label: 'Position' },
        ]}
        onNew={handleNew}
        onReadMore={(id) => setDetailRecommendation(cards.find((c) => c.id === id)?.raw)}
        // Card click always opens the read-only detail (consistent with the
        // other sections, and reachable even for a result-with-no-note). The
        // detail modal's Update button (admin/mentor) enters the edit form.
        onCardClick={(card) => setDetailRecommendation(card.raw)}
        emptyMessage={
          isError ? 'Failed to load recommendations.' : 'No recommendations recorded yet.'
        }
      />

      <DetailModal
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
        title={isEditing ? 'Edit recommendation' : 'New recommendation'}
        sections={[
          {
            label: 'Recommendation',
            content: (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="recommendation-position">
                      Position <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={form.positionId}
                      onValueChange={(positionId) => setForm((prev) => ({ ...prev, positionId }))}
                    >
                      <SelectTrigger
                        id="recommendation-position"
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
                  <div className="space-y-2">
                    <Label htmlFor="recommendation-project">
                      Project <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="recommendation-project"
                      value={form.project}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, project: event.target.value }))
                      }
                      placeholder="e.g. Acme onboarding revamp"
                      maxLength={200}
                      data-test="recommendation-project-input"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <StatusSegmented
                    value={form.status}
                    onChange={(status) => setForm((prev) => ({ ...prev, status }))}
                  />
                </div>
                <TechnologyPicker
                  technologies={technologies}
                  selectedIds={form.technologyIds}
                  onChange={(technologyIds) => setForm((prev) => ({ ...prev, technologyIds }))}
                />
                <div className="space-y-2">
                  <Label htmlFor="recommendation-note">Recommendation note</Label>
                  <AutoTextarea
                    id="recommendation-note"
                    value={form.recommendationNote}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, recommendationNote: event.target.value }))
                    }
                    rows={4}
                    placeholder="Recommendation details…"
                    data-test="recommendation-note-input"
                  />
                </div>
              </div>
            ),
          },
          ...(isEditing
            ? [
                {
                  label: 'Placement outcome',
                  content: (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Placement result</Label>
                        <Select
                          value={form.resultOutcome}
                          onValueChange={(resultOutcome) =>
                            setForm((prev) => ({ ...prev, resultOutcome }))
                          }
                        >
                          <SelectTrigger data-test="recommendation-result-select">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No result</SelectItem>
                            {RECOMMENDATION_RESULTS.map((result) => (
                              <SelectItem key={result.value} value={result.value}>
                                {result.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="recommendation-result-note">Result note</Label>
                        <AutoTextarea
                          id="recommendation-result-note"
                          value={form.resultNote}
                          onChange={(event) =>
                            setForm((prev) => ({ ...prev, resultNote: event.target.value }))
                          }
                          rows={3}
                          required={form.resultOutcome !== 'none'}
                          placeholder="Notes on the result…"
                          data-test="recommendation-result-note-input"
                        />
                      </div>
                    </div>
                  ),
                },
              ]
            : []),
        ]}
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving} data-test="recommendation-submit-button">
              {isSaving
                ? 'Saving...'
                : isEditing
                  ? 'Update recommendation'
                  : 'Create recommendation'}
            </Button>
          </>
        }
      />

      <DetailModal
        open={Boolean(detailRecommendation)}
        onClose={() => setDetailRecommendation(null)}
        dataTest="intern-recommendation-detail-dialog"
        title={detailRecommendation ? positionName(detailRecommendation) : 'Recommendation'}
        subtitle={
          detailRecommendation
            ? `Updated ${formatDate(detailRecommendation.updatedAt)} by ${
                detailRecommendation.updatedBy?.fullname || 'Unknown'
              }`
            : undefined
        }
        sections={
          detailRecommendation
            ? [
                {
                  label: 'Recommendation',
                  content: (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            'rounded-md px-2 py-1 text-xs font-semibold',
                            TAG_TONE[statusTagColor(detailRecommendation.status)]
                          )}
                        >
                          {getRecommendationStatusLabel(detailRecommendation.status)}
                        </span>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                            Position
                          </p>
                          <p className="text-sm font-medium text-foreground">
                            {positionName(detailRecommendation)}
                          </p>
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                            Project
                          </p>
                          <p className="text-sm font-medium text-foreground [overflow-wrap:anywhere]">
                            {detailRecommendation.project || '—'}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                          Technologies
                        </p>
                        {(detailRecommendation.technologies || []).length === 0 ? (
                          <span className="text-sm text-muted-foreground">None selected.</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {detailRecommendation.technologies.map((technology) => (
                              <Badge
                                key={technology._id}
                                variant="outline"
                                className="gap-1.5 pl-2"
                              >
                                <TechnologyIcon
                                  technology={technology}
                                  size={13}
                                  className="shrink-0"
                                />
                                {technology.name}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      {detailRecommendation.recommendationNote && (
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                            Note
                          </p>
                          <DetailText>{detailRecommendation.recommendationNote}</DetailText>
                        </div>
                      )}
                    </div>
                  ),
                },
                ...(detailRecommendation.result?.outcome
                  ? [
                      {
                        label: 'Placement outcome',
                        content: (
                          <div className="space-y-1.5 rounded-xl bg-muted/50 p-4">
                            <p className="text-sm font-semibold text-foreground">
                              {getRecommendationResultLabel(detailRecommendation.result.outcome)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(detailRecommendation.result.decidedAt)} by{' '}
                              {detailRecommendation.result.decidedBy?.fullname || 'Unknown'}
                            </p>
                            {detailRecommendation.result.note && (
                              <DetailText>{detailRecommendation.result.note}</DetailText>
                            )}
                          </div>
                        ),
                      },
                    ]
                  : []),
              ]
            : []
        }
        footer={
          <>
            {canWrite && (
              <Button
                type="button"
                onClick={() => {
                  const target = detailRecommendation;
                  setDetailRecommendation(null);
                  handleEdit(target);
                }}
              >
                Update
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => setDetailRecommendation(null)}>
              Close
            </Button>
          </>
        }
      />
    </div>
  );
}
