import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AutoTextarea } from '@/components/ui/auto-textarea';
import { ChipsCell, SectionHistory, TruncatedCell } from '@/components/interns/SectionHistory';
import { useAuth } from '@/context/AuthContext';
import { ROLES } from '@/helpers/roles';
import {
  getRecommendationResultLabel,
  getRecommendationResultVariant,
  getRecommendationStatusLabel,
  getRecommendationStatusVariant,
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

  const columns = [
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      nowrap: true,
      accessor: (row) => getRecommendationStatusLabel(row.status),
      render: (row) => (
        <Badge variant={getRecommendationStatusVariant(row.status)}>
          {getRecommendationStatusLabel(row.status)}
        </Badge>
      ),
    },
    {
      key: 'result',
      header: 'Result',
      sortable: true,
      nowrap: true,
      accessor: (row) =>
        row.result?.outcome ? getRecommendationResultLabel(row.result.outcome) : '',
      render: (row) =>
        row.result?.outcome ? (
          <Badge variant={getRecommendationResultVariant(row.result.outcome)}>
            {getRecommendationResultLabel(row.result.outcome)}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'technologies',
      header: 'Technologies',
      sortable: true,
      accessor: (row) => (row.technologies || []).length,
      render: (row) => (
        <ChipsCell
          items={(row.technologies || []).map((technology) => ({
            key: technology._id,
            label: technology.name,
          }))}
        />
      ),
    },
    {
      key: 'note',
      header: 'Note',
      render: (row) => <TruncatedCell text={row.recommendationNote} />,
    },
    {
      key: 'updatedBy',
      header: 'Updated by',
      sortable: true,
      nowrap: true,
      accessor: (row) => row.updatedBy?.fullname ?? '',
      render: (row) => (
        <span className="text-muted-foreground">{row.updatedBy?.fullname || 'Unknown'}</span>
      ),
    },
    {
      key: 'updatedAt',
      header: 'Updated',
      sortable: true,
      nowrap: true,
      accessor: (row) => new Date(row.updatedAt).getTime(),
      render: (row) => (
        <span className="tabular-nums text-muted-foreground">{formatDate(row.updatedAt)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <SectionHistory
        title="Recommendation history"
        columns={columns}
        data={recommendations}
        isLoading={isPending}
        canWrite={canWrite}
        newLabel="New recommendation"
        onNew={handleNew}
        onRowClick={setDetailRecommendation}
        rowAction={{ label: 'Update', onClick: handleEdit }}
        emptyMessage={
          isError ? 'Failed to load recommendations.' : 'No recommendations recorded yet.'
        }
        dataTestPrefix="intern-recommendation"
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit recommendation' : 'New recommendation'}</DialogTitle>
          </DialogHeader>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
              <TechnologyPicker
                technologies={technologies}
                selectedIds={form.technologyIds}
                onChange={(technologyIds) => setForm((prev) => ({ ...prev, technologyIds }))}
              />
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="recommendation-note">Recommendation note</Label>
              <AutoTextarea
                id="recommendation-note"
                value={form.recommendationNote}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, recommendationNote: event.target.value }))
                }
                rows={4}
                data-test="recommendation-note-input"
              />
            </div>

            {isEditing && (
              <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
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
                    data-test="recommendation-result-note-input"
                  />
                </div>
              </div>
            )}

            <DialogFooter>
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
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(detailRecommendation)}
        onOpenChange={(open) => !open && setDetailRecommendation(null)}
      >
        <DialogContent
          className="max-w-lg overflow-hidden"
          data-test="intern-recommendation-detail-dialog"
        >
          {detailRecommendation && (
            <>
              <DialogHeader className="min-w-0">
                <DialogTitle>Recommendation</DialogTitle>
                <DialogDescription>
                  Updated {formatDate(detailRecommendation.updatedAt)} by{' '}
                  {detailRecommendation.updatedBy?.fullname || 'Unknown'}
                </DialogDescription>
              </DialogHeader>
              <div className="min-w-0 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={getRecommendationStatusVariant(detailRecommendation.status)}>
                    {getRecommendationStatusLabel(detailRecommendation.status)}
                  </Badge>
                  {detailRecommendation.result?.outcome && (
                    <Badge
                      variant={getRecommendationResultVariant(detailRecommendation.result.outcome)}
                    >
                      {getRecommendationResultLabel(detailRecommendation.result.outcome)}
                    </Badge>
                  )}
                </div>

                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-foreground">Technologies</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(detailRecommendation.technologies || []).length === 0 && (
                      <span className="text-sm text-muted-foreground">None selected.</span>
                    )}
                    {(detailRecommendation.technologies || []).map((technology) => (
                      <Badge key={technology._id} variant="outline">
                        {technology.name}
                      </Badge>
                    ))}
                  </div>
                </div>

                {detailRecommendation.recommendationNote && (
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium text-foreground">Note</p>
                    <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground [overflow-wrap:anywhere]">
                      {detailRecommendation.recommendationNote}
                    </p>
                  </div>
                )}

                {detailRecommendation.result?.outcome && (
                  <div className="space-y-1.5 rounded-lg border border-border/60 p-3">
                    <p className="text-sm font-semibold text-foreground">
                      Result: {getRecommendationResultLabel(detailRecommendation.result.outcome)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(detailRecommendation.result.decidedAt)} by{' '}
                      {detailRecommendation.result.decidedBy?.fullname || 'Unknown'}
                    </p>
                    {detailRecommendation.result.note && (
                      <p className="whitespace-pre-line text-sm text-foreground [overflow-wrap:anywhere]">
                        {detailRecommendation.result.note}
                      </p>
                    )}
                  </div>
                )}
              </div>
              <DialogFooter>
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
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDetailRecommendation(null)}
                >
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
