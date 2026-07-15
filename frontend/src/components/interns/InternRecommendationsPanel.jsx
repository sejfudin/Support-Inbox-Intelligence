import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { Chips, DetailModal, DetailText, TAG_TONE } from '@/components/interns/DetailModal';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { ROLES } from '@/helpers/roles';
import {
  getRecommendationResultLabel,
  getRecommendationStatusLabel,
  RECOMMENDATION_RESULTS,
  RECOMMENDATION_STATUSES,
} from '@/helpers/recommendations';
import { useTechnologies } from '@/queries/technologies';
import {
  useCreateRecommendation,
  useRecommendations,
  useUpdateRecommendation,
} from '@/queries/recommendations';

const createEmptyForm = () => ({
  technologyIds: [],
  recommendationNote: '',
  status: 'draft',
  resultOutcome: 'none',
  resultNote: '',
});

const formatDate = (date) => {
  if (!date) return 'No date';
  return format(new Date(date), 'MMM d, yyyy');
};

const formFromRecommendation = (recommendation) => ({
  technologyIds: (recommendation.technologies || []).map((technology) => technology._id),
  recommendationNote: recommendation.recommendationNote || '',
  status: recommendation.status || 'draft',
  resultOutcome: recommendation.result?.outcome || 'none',
  resultNote: recommendation.result?.note || '',
});

function TechnologyPicker({ technologies, selectedIds, onChange }) {
  const selectedTechnologies = useMemo(
    () => technologies.filter((technology) => selectedIds.includes(technology._id)),
    [selectedIds, technologies]
  );

  const availableTechnologies = technologies.filter(
    (technology) => !selectedIds.includes(technology._id)
  );

  return (
    <div className="space-y-2">
      <Label>Technologies</Label>
      {/* Selecting a technology adds it immediately; the picker resets to its
          placeholder via `value=""` so there is no separate "Add" step. */}
      <Select
        value=""
        onValueChange={(technologyId) => {
          if (technologyId) onChange([...selectedIds, technologyId]);
        }}
        disabled={availableTechnologies.length === 0}
      >
        <SelectTrigger data-test="recommendation-technology-select">
          <SelectValue
            placeholder={
              availableTechnologies.length === 0 ? 'All technologies added' : 'Add technology'
            }
          />
        </SelectTrigger>
        <SelectContent>
          {availableTechnologies.map((technology) => (
            <SelectItem key={technology._id} value={technology._id}>
              {technology.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex min-h-6 flex-wrap gap-2">
        {selectedTechnologies.map((technology) => (
          <Badge key={technology._id} variant="outline" className="gap-2">
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
    </div>
  );
}

export function InternRecommendationsPanel({ userId, readOnly = false }) {
  const { user } = useAuth();
  const canWrite = !readOnly && user?.role === ROLES.MENTOR;
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

  useEffect(() => {
    if (!activeRecommendation) return;
    const freshRecommendation = recommendations.find(
      (recommendation) => recommendation._id === activeRecommendation._id
    );
    if (freshRecommendation) {
      setActiveRecommendation(freshRecommendation);
      setForm(formFromRecommendation(freshRecommendation));
    }
  }, [activeRecommendation, recommendations]);

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

  const handleSubmit = (event) => {
    event.preventDefault();

    const payload = {
      internUserId: userId,
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
    if (status === 'draft') return 'slate';
    return 'indigo';
  };
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
    title: resultTitle(recommendation),
    metaSub: `Updated ${formatDate(recommendation.updatedAt)} · ${
      recommendation.updatedBy?.fullname || 'Unknown'
    }`,
    blocks: [
      {
        kind: 'chips',
        label: 'Technologies',
        items: (recommendation.technologies || []).map((technology) => technology.name),
      },
    ],
    note: recommendation.recommendationNote,
    sortVals: {
      updated: new Date(recommendation.updatedAt).getTime(),
      status: getRecommendationStatusLabel(recommendation.status),
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
        ]}
        onNew={handleNew}
        onReadMore={(id) => setDetailRecommendation(cards.find((c) => c.id === id)?.raw)}
        onCardClick={(card) =>
          canWrite ? handleEdit(card.raw) : setDetailRecommendation(card.raw)
        }
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
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(status) => setForm((prev) => ({ ...prev, status }))}
                  >
                    <SelectTrigger data-test="recommendation-status-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RECOMMENDATION_STATUSES.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
        title={detailRecommendation ? resultTitle(detailRecommendation) : 'Recommendation'}
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
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                          Technologies
                        </p>
                        <Chips
                          emptyLabel="None selected."
                          items={(detailRecommendation.technologies || []).map(
                            (technology) => technology.name
                          )}
                        />
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
