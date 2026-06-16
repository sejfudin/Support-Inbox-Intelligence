import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Plus } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { InternPanel } from '@/components/interns/InternPanel';
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
  const [selectedTechnologyId, setSelectedTechnologyId] = useState('');
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
      <div className="flex gap-2">
        <Select value={selectedTechnologyId || 'none'} onValueChange={setSelectedTechnologyId}>
          <SelectTrigger data-test="recommendation-technology-select">
            <SelectValue placeholder="Add technology" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Select technology</SelectItem>
            {availableTechnologies.map((technology) => (
              <SelectItem key={technology._id} value={technology._id}>
                {technology.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          disabled={!selectedTechnologyId || selectedTechnologyId === 'none'}
          onClick={() => {
            onChange([...selectedIds, selectedTechnologyId]);
            setSelectedTechnologyId('');
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add
        </Button>
      </div>
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
              x
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

function RecommendationForm({
  activeRecommendation,
  form,
  setForm,
  technologies,
  onCancel,
  onSubmit,
  isSaving,
}) {
  const isEditing = Boolean(activeRecommendation);

  return (
    <InternPanel>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-foreground">
          {isEditing ? 'Edit recommendation' : 'New recommendation'}
        </h3>
        {isEditing && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel edit
          </Button>
        )}
      </div>

      <form className="mt-5 space-y-5" onSubmit={onSubmit}>
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
          <Textarea
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
                onValueChange={(resultOutcome) => setForm((prev) => ({ ...prev, resultOutcome }))}
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
              <Textarea
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

        <Button type="submit" disabled={isSaving} data-test="recommendation-submit-button">
          {isSaving ? 'Saving...' : isEditing ? 'Update recommendation' : 'Create recommendation'}
        </Button>
      </form>
    </InternPanel>
  );
}

function RecommendationSummary({ recommendation, canWrite, onEdit }) {
  return (
    <li
      className="rounded-xl border border-border/60 p-4"
      data-test={`intern-recommendation-${recommendation._id}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={getRecommendationStatusVariant(recommendation.status)}>
              {getRecommendationStatusLabel(recommendation.status)}
            </Badge>
            {recommendation.result?.outcome && (
              <Badge variant={getRecommendationResultVariant(recommendation.result.outcome)}>
                {getRecommendationResultLabel(recommendation.result.outcome)}
              </Badge>
            )}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Updated {formatDate(recommendation.updatedAt)} by{' '}
            {recommendation.updatedBy?.fullname || 'Unknown'}
          </p>
        </div>
        {canWrite && (
          <Button type="button" variant="outline" size="sm" onClick={() => onEdit(recommendation)}>
            Update
          </Button>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {(recommendation.technologies || []).length === 0 && (
          <span className="text-sm text-muted-foreground">No technologies selected.</span>
        )}
        {(recommendation.technologies || []).map((technology) => (
          <Badge key={technology._id} variant="outline">
            {technology.name}
          </Badge>
        ))}
      </div>

      {recommendation.recommendationNote && (
        <p className="mt-4 whitespace-pre-line text-sm leading-6 text-foreground">
          {recommendation.recommendationNote}
        </p>
      )}

      {recommendation.result?.outcome && (
        <div className="mt-5 rounded-lg border border-border/60 p-3">
          <p className="text-sm font-semibold text-foreground">
            Result: {getRecommendationResultLabel(recommendation.result.outcome)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatDate(recommendation.result.decidedAt)} by{' '}
            {recommendation.result.decidedBy?.fullname || 'Unknown'}
          </p>
          <p className="mt-2 whitespace-pre-line text-sm text-foreground">
            {recommendation.result.note}
          </p>
        </div>
      )}
    </li>
  );
}

export function InternRecommendationsPanel({ userId, readOnly = false }) {
  const { user } = useAuth();
  const canWrite = !readOnly && user?.role === ROLES.ADMIN;
  const { data: technologies = [] } = useTechnologies();
  const { data, isPending, isError } = useRecommendations({
    internUserId: userId,
    limit: 50,
  });
  const { mutate: createRecommendation, isPending: isCreating } = useCreateRecommendation();
  const { mutate: updateRecommendation, isPending: isUpdating } = useUpdateRecommendation();

  const [activeRecommendation, setActiveRecommendation] = useState(null);
  const [form, setForm] = useState(createEmptyForm);

  const recommendations = data?.recommendations ?? [];
  const isSaving = isCreating || isUpdating;

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

  const resetForm = () => {
    setActiveRecommendation(null);
    setForm(createEmptyForm());
  };

  const handleEdit = (recommendation) => {
    setActiveRecommendation(recommendation);
    setForm(formFromRecommendation(recommendation));
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
        resetForm();
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

  return (
    <div className="space-y-6">
      {canWrite && (
        <RecommendationForm
          activeRecommendation={activeRecommendation}
          form={form}
          setForm={setForm}
          technologies={technologies}
          onCancel={resetForm}
          onSubmit={handleSubmit}
          isSaving={isSaving}
        />
      )}

      <InternPanel>
        <h3 className="text-lg font-semibold text-foreground">Recommendation history</h3>
        {isPending && (
          <p className="mt-4 text-sm text-muted-foreground">Loading recommendations...</p>
        )}
        {isError && (
          <p className="mt-4 text-sm text-destructive">Failed to load recommendations.</p>
        )}
        {!isPending && !isError && recommendations.length === 0 && (
          <p className="mt-4 text-sm text-muted-foreground">No recommendations recorded yet.</p>
        )}
        {!isPending && !isError && recommendations.length > 0 && (
          <ul className="mt-4 space-y-4">
            {recommendations.map((recommendation) => (
              <RecommendationSummary
                key={recommendation._id}
                recommendation={recommendation}
                canWrite={canWrite}
                onEdit={handleEdit}
              />
            ))}
          </ul>
        )}
      </InternPanel>
    </div>
  );
}
