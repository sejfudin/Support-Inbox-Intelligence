import { useState } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { InternPanel } from '@/components/interns/InternPanel';
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

export function InternEvaluationsPanel({ userId, readOnly = false }) {
  const { user } = useAuth();
  const canWrite = !readOnly && canWriteInternMentorData(user?.role);
  const { data: evaluations = [], isPending } = useInternEvaluations(userId);
  const { mutate, isPending: isSaving } = useCreateInternEvaluation();

  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [scores, setScores] = useState(defaultScores);
  const [notes, setNotes] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    mutate(
      {
        userId,
        payload: { periodStart, periodEnd, scores, notes },
      },
      {
        onSuccess: () => {
          setPeriodStart('');
          setPeriodEnd('');
          setScores(defaultScores);
          setNotes('');
          toast.success('Evaluation saved');
        },
        onError: (err) => toast.error(err?.response?.data?.message || 'Failed to save evaluation'),
      }
    );
  };

  return (
    <div className="space-y-6">
      {canWrite && (
        <InternPanel>
          <h3 className="text-lg font-semibold">New evaluation</h3>
          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="eval-period-start">Period start</Label>
                <Input
                  id="eval-period-start"
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  required
                  data-test="intern-evaluation-start-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eval-period-end">Period end</Label>
                <Input
                  id="eval-period-end"
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  required
                  data-test="intern-evaluation-end-input"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {EVALUATION_CRITERIA.map((criterion) => (
                <div key={criterion.key} className="space-y-2">
                  <Label htmlFor={`eval-${criterion.key}`}>{criterion.label}</Label>
                  <Input
                    id={`eval-${criterion.key}`}
                    type="number"
                    min={1}
                    max={5}
                    value={scores[criterion.key]}
                    onChange={(e) =>
                      setScores((prev) => ({
                        ...prev,
                        [criterion.key]: Number(e.target.value),
                      }))
                    }
                    data-test={`intern-evaluation-${criterion.key}-input`}
                  />
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="eval-notes">Notes</Label>
              <Textarea
                id="eval-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                data-test="intern-evaluation-notes-input"
              />
            </div>
            <Button type="submit" disabled={isSaving} data-test="intern-evaluation-submit-button">
              {isSaving ? 'Saving...' : 'Save evaluation'}
            </Button>
          </form>
        </InternPanel>
      )}

      <InternPanel>
        <h3 className="text-lg font-semibold">Evaluation history</h3>
        {isPending && <p className="mt-4 text-sm text-muted-foreground">Loading evaluations...</p>}
        {!isPending && evaluations.length === 0 && (
          <p className="mt-4 text-sm text-muted-foreground">No evaluations recorded yet.</p>
        )}
        <ul className="mt-4 space-y-4">
          {evaluations.map((evaluation) => (
            <li
              key={evaluation._id}
              className="rounded-xl border border-border/60 p-4"
              data-test={`intern-evaluation-${evaluation._id}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-foreground">
                  {format(new Date(evaluation.periodStart), 'MMM d, yyyy')} –{' '}
                  {format(new Date(evaluation.periodEnd), 'MMM d, yyyy')}
                </p>
                <p className="text-sm text-muted-foreground">
                  Avg {evaluation.averageScore}/5 · {evaluation.evaluator?.fullname}
                </p>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {EVALUATION_CRITERIA.map((criterion) => (
                  <p key={criterion.key} className="text-sm text-muted-foreground">
                    {criterion.label}:{' '}
                    <span className="font-medium text-foreground">
                      {evaluation.scores?.[criterion.key]}/5
                    </span>
                  </p>
                ))}
              </div>
              {evaluation.notes && (
                <p className="mt-3 text-sm leading-6 text-foreground">{evaluation.notes}</p>
              )}
            </li>
          ))}
        </ul>
      </InternPanel>
    </div>
  );
}
