import { useState } from 'react';
import { format } from 'date-fns';
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
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { AutoTextarea } from '@/components/ui/auto-textarea';
import { SectionHistory, TruncatedCell } from '@/components/interns/SectionHistory';
import { EVALUATION_CRITERIA } from '@/helpers/internProfile';
import { useAuth } from '@/context/AuthContext';
import { canWriteInternMentorData } from '@/helpers/roles';
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

const getAverageVariant = (average) => {
  if (average >= 4) return 'success';
  if (average >= 3) return 'default';
  return 'warning';
};

export function InternEvaluationsPanel({ userId, readOnly = false }) {
  const { user } = useAuth();
  const canWrite = !readOnly && canWriteInternMentorData(user?.role);
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

  const columns = [
    {
      key: 'period',
      header: 'Period',
      sortable: true,
      nowrap: true,
      accessor: (row) => new Date(row.periodStart).getTime(),
      render: (row) => (
        <span className="font-medium text-foreground">
          {format(new Date(row.periodStart), 'MMM d, yyyy')} –{' '}
          {format(new Date(row.periodEnd), 'MMM d, yyyy')}
        </span>
      ),
    },
    ...EVALUATION_CRITERIA.map((criterion) => ({
      key: criterion.key,
      header: criterion.label,
      sortable: true,
      align: 'center',
      accessor: (row) => row.scores?.[criterion.key] ?? 0,
      render: (row) => <span className="tabular-nums">{row.scores?.[criterion.key] ?? '—'}/5</span>,
    })),
    {
      key: 'average',
      header: 'Avg',
      sortable: true,
      align: 'center',
      accessor: (row) => getAverage(row),
      render: (row) => {
        const average = getAverage(row);
        return <Badge variant={getAverageVariant(average)}>{Number(average).toFixed(1)}/5</Badge>;
      },
    },
    {
      key: 'evaluator',
      header: 'Evaluator',
      sortable: true,
      nowrap: true,
      accessor: (row) => row.evaluator?.fullname ?? '',
      render: (row) => (
        <span className="text-muted-foreground">{row.evaluator?.fullname ?? '—'}</span>
      ),
    },
    {
      key: 'notes',
      header: 'Notes',
      render: (row) => <TruncatedCell text={row.notes} />,
    },
  ];

  return (
    <div className="space-y-6">
      <SectionHistory
        title="Evaluation history"
        columns={columns}
        data={evaluations}
        isLoading={isPending}
        canWrite={canWrite}
        newLabel="New evaluation"
        onNew={openDialog}
        onRowClick={setDetailEvaluation}
        emptyMessage="No evaluations recorded yet."
        dataTestPrefix="intern-evaluation"
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

      <Dialog
        open={Boolean(detailEvaluation)}
        onOpenChange={(open) => !open && setDetailEvaluation(null)}
      >
        <DialogContent
          className="max-w-lg overflow-hidden"
          data-test="intern-evaluation-detail-dialog"
        >
          {detailEvaluation && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {format(new Date(detailEvaluation.periodStart), 'MMM d, yyyy')} –{' '}
                  {format(new Date(detailEvaluation.periodEnd), 'MMM d, yyyy')}
                </DialogTitle>
                <DialogDescription>
                  Evaluated by {detailEvaluation.evaluator?.fullname ?? 'Unknown'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-5">
                <div className="flex items-center justify-between rounded-lg border border-border/60 px-4 py-3">
                  <span className="text-sm font-medium text-muted-foreground">Average score</span>
                  <Badge variant={getAverageVariant(getAverage(detailEvaluation))}>
                    {Number(getAverage(detailEvaluation)).toFixed(1)}/5
                  </Badge>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {EVALUATION_CRITERIA.map((criterion) => (
                    <div
                      key={criterion.key}
                      className="flex items-center justify-between rounded-lg border border-border/60 px-4 py-2.5"
                    >
                      <span className="text-sm text-muted-foreground">{criterion.label}</span>
                      <span className="text-sm font-semibold tabular-nums text-foreground">
                        {detailEvaluation.scores?.[criterion.key] ?? '—'}/5
                      </span>
                    </div>
                  ))}
                </div>
                {detailEvaluation.notes && (
                  <div className="min-w-0 space-y-1.5">
                    <p className="text-sm font-medium text-foreground">Notes</p>
                    <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground [overflow-wrap:anywhere]">
                      {detailEvaluation.notes}
                    </p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDetailEvaluation(null)}>
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
