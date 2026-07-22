import { useState } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { AutoTextarea } from '@/components/ui/auto-textarea';
import { HistoryPanel } from '@/components/interns/HistoryPanel';
import { DetailModal, DetailText, ScoreBanner, ScoreTiles } from '@/components/interns/DetailModal';
import { EVALUATION_CRITERIA } from '@/helpers/internProfile';
import { getInitials } from '@/helpers/getInitials';
import { useAuth } from '@/context/AuthContext';
import { ROLES } from '@/helpers/roles';
import { useCreateInternEvaluation, useInternEvaluations } from '@/queries/interns';
import { toast } from 'sonner';

const defaultScores = {
  technical: 3,
  communication: 3,
  ownership: 3,
  growth: 3,
};

const getAverage = (evaluation) => {
  if (typeof evaluation.averageScore === 'number') return evaluation.averageScore;
  const values = EVALUATION_CRITERIA.map((criterion) => evaluation.scores?.[criterion.key] ?? 0);
  const sum = values.reduce((total, value) => total + value, 0);
  return values.length ? sum / values.length : 0;
};

export function InternEvaluationsPanel({ userId, readOnly = false }) {
  const { user } = useAuth();
  const canWrite = !readOnly && user?.role === ROLES.ADMIN;
  const { data: evaluations = [], isPending } = useInternEvaluations(userId);
  const { mutate, isPending: isSaving } = useCreateInternEvaluation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailEvaluation, setDetailEvaluation] = useState(null);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [scores, setScores] = useState(defaultScores);
  const [notes, setNotes] = useState('');

  const resetForm = () => {
    setPeriodStart('');
    setPeriodEnd('');
    setScores(defaultScores);
    setNotes('');
  };

  const openDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!periodStart || !periodEnd) {
      toast.error('Select a period start and end date');
      return;
    }

    mutate(
      {
        userId,
        payload: { periodStart, periodEnd, scores, notes },
      },
      {
        onSuccess: () => {
          resetForm();
          setDialogOpen(false);
          toast.success('Evaluation saved');
        },
        onError: (err) => toast.error(err?.response?.data?.message || 'Failed to save evaluation'),
      }
    );
  };

  const formatPeriod = (evaluation) =>
    `${format(new Date(evaluation.periodStart), 'MMM d')} – ${format(new Date(evaluation.periodEnd), 'MMM d, yyyy')}`;

  // Newest first so the latest evaluation is the featured card and we can
  // compute the trend delta against the chronologically previous one.
  const ordered = [...evaluations].sort(
    (a, b) => new Date(b.periodStart) - new Date(a.periodStart)
  );

  const cards = ordered.map((evaluation, index) => {
    const avg = getAverage(evaluation);
    const isLatest = index === 0;
    const prev = ordered[index + 1];
    const delta = prev ? avg - getAverage(prev) : 0;
    let trend = { kind: 'flat' };
    if (prev && delta > 0.05) trend = { kind: 'up', delta };
    else if (prev && delta < -0.05) trend = { kind: 'down', delta };
    return {
      id: evaluation._id,
      raw: evaluation,
      featured: isLatest,
      tag: isLatest ? { label: 'Latest', color: 'green' } : undefined,
      title: formatPeriod(evaluation),
      ring: { value: avg, label: 'Overall', trend },
      avatar: {
        initials: getInitials(evaluation.evaluator?.fullname),
        name: evaluation.evaluator?.fullname ?? 'Unknown',
      },
      blocks: [
        {
          kind: 'bars',
          items: EVALUATION_CRITERIA.map((criterion) => ({
            label: criterion.label,
            score: evaluation.scores?.[criterion.key] ?? 0,
          })),
        },
      ],
      note: evaluation.notes,
      sortVals: { period: new Date(evaluation.periodStart).getTime(), average: avg },
    };
  });

  const latestDelta = cards.length > 1 ? cards[0].ring.value - getAverage(ordered[1]) : 0;
  const trendLabel =
    latestDelta > 0.05
      ? ' · trending upward'
      : latestDelta < -0.05
        ? ' · trending down'
        : ' · steady';
  const subtitle = `${cards.length} evaluation${cards.length === 1 ? '' : 's'}${
    cards.length > 1 ? trendLabel : ''
  }`;

  return (
    <div className="space-y-6">
      <HistoryPanel
        title="Evaluation history"
        subtitle={subtitle}
        buttonLabel="New evaluation"
        canWrite={canWrite}
        isLoading={isPending}
        cards={cards}
        sortOptions={[
          { key: 'period', label: 'Period' },
          { key: 'average', label: 'Average' },
        ]}
        onNew={openDialog}
        onReadMore={(id) => setDetailEvaluation(cards.find((c) => c.id === id)?.raw)}
        onCardClick={(card) => setDetailEvaluation(card.raw)}
        emptyMessage="No evaluations recorded yet."
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>New evaluation</DialogTitle>
          </DialogHeader>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="eval-period-start">Period start</Label>
                <DatePicker
                  id="eval-period-start"
                  value={periodStart}
                  onChange={setPeriodStart}
                  placeholder="Select start date"
                  data-test="intern-evaluation-start-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eval-period-end">Period end</Label>
                <DatePicker
                  id="eval-period-end"
                  value={periodEnd}
                  onChange={setPeriodEnd}
                  placeholder="Select end date"
                  data-test="intern-evaluation-end-input"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {EVALUATION_CRITERIA.map((criterion) => (
                <div key={criterion.key} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={`eval-${criterion.key}`}>{criterion.label}</Label>
                    <span className="text-sm font-semibold text-primary">
                      {scores[criterion.key]}
                    </span>
                  </div>
                  <Slider
                    id={`eval-${criterion.key}`}
                    min={1}
                    max={5}
                    step={1}
                    value={[scores[criterion.key]]}
                    onValueChange={([value]) =>
                      setScores((prev) => ({
                        ...prev,
                        [criterion.key]: value,
                      }))
                    }
                    data-test={`intern-evaluation-${criterion.key}-input`}
                  />
                  <div className="-mt-2 flex justify-between text-[11px] font-medium text-muted-foreground">
                    {[1, 2, 3, 4, 5].map((tick) => (
                      <span key={tick}>{tick}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="eval-notes">Notes</Label>
              <AutoTextarea
                id="eval-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                data-test="intern-evaluation-notes-input"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving} data-test="intern-evaluation-submit-button">
                {isSaving ? 'Saving...' : 'Save evaluation'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <DetailModal
        open={Boolean(detailEvaluation)}
        onClose={() => setDetailEvaluation(null)}
        dataTest="intern-evaluation-detail-dialog"
        title={
          detailEvaluation
            ? `${format(new Date(detailEvaluation.periodStart), 'MMM d, yyyy')} – ${format(
                new Date(detailEvaluation.periodEnd),
                'MMM d, yyyy'
              )}`
            : ''
        }
        subtitle={
          detailEvaluation
            ? `Evaluated by ${detailEvaluation.evaluator?.fullname ?? 'Unknown'}`
            : undefined
        }
        sections={
          detailEvaluation
            ? [
                {
                  content: <ScoreBanner value={getAverage(detailEvaluation)} />,
                },
                {
                  content: (
                    <ScoreTiles
                      items={EVALUATION_CRITERIA.map((criterion) => ({
                        label: criterion.label,
                        score: detailEvaluation.scores?.[criterion.key] ?? 0,
                      }))}
                    />
                  ),
                },
                ...(detailEvaluation.notes
                  ? [{ label: 'Notes', content: <DetailText>{detailEvaluation.notes}</DetailText> }]
                  : []),
              ]
            : []
        }
      />
    </div>
  );
}
