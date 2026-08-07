import { useEffect, useState } from 'react';
import { toast } from 'sonner';
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
import { EVALUATION_CRITERIA } from '@/helpers/internProfile';
import { useCreateInternEvaluation, useIntern } from '@/queries/interns';

const defaultScores = () =>
  EVALUATION_CRITERIA.reduce((scores, criterion) => ({ ...scores, [criterion.key]: 3 }), {});

/**
 * "Write evaluation" from the dashboard, without leaving the dashboard.
 *
 * The same fields and the same mutation as the evaluations panel on the intern's
 * profile — periods, a 1–5 slider per criterion from EVALUATION_CRITERIA, and
 * notes. The criteria list is shared, so adding a criterion updates both screens.
 */
export function NewEvaluationDialog({ internUserId, open, onClose }) {
  const { data: intern } = useIntern(internUserId, { enabled: Boolean(internUserId) });
  const { mutate, isPending: isSaving } = useCreateInternEvaluation();

  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [scores, setScores] = useState(defaultScores);
  const [notes, setNotes] = useState('');

  const internName = intern?.user?.fullname || 'this intern';

  // Reset per open, so the previous intern's draft is never submitted against the
  // next one the picker lands on.
  useEffect(() => {
    if (open) {
      setPeriodStart('');
      setPeriodEnd('');
      setScores(defaultScores());
      setNotes('');
    }
  }, [open, internUserId]);

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!periodStart || !periodEnd) {
      toast.error('Select a period start and end date');
      return;
    }

    mutate(
      { userId: internUserId, payload: { periodStart, periodEnd, scores, notes } },
      {
        onSuccess: () => {
          toast.success(`Evaluation saved for ${internName}`);
          onClose();
        },
        onError: (err) => toast.error(err?.response?.data?.message || 'Failed to save evaluation'),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New evaluation — {internName}</DialogTitle>
        </DialogHeader>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dash-eval-period-start">Period start</Label>
              <DatePicker
                id="dash-eval-period-start"
                value={periodStart}
                onChange={setPeriodStart}
                placeholder="Select start date"
                data-test="dashboard-evaluation-start-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dash-eval-period-end">Period end</Label>
              <DatePicker
                id="dash-eval-period-end"
                value={periodEnd}
                onChange={setPeriodEnd}
                placeholder="Select end date"
                data-test="dashboard-evaluation-end-input"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {EVALUATION_CRITERIA.map((criterion) => (
              <div key={criterion.key} className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor={`dash-eval-${criterion.key}`}>{criterion.label}</Label>
                  <span className="text-sm font-semibold text-primary">
                    {scores[criterion.key]}
                  </span>
                </div>
                <Slider
                  id={`dash-eval-${criterion.key}`}
                  min={1}
                  max={5}
                  step={1}
                  value={[scores[criterion.key]]}
                  onValueChange={([value]) =>
                    setScores((prev) => ({ ...prev, [criterion.key]: value }))
                  }
                  data-test={`dashboard-evaluation-${criterion.key}-input`}
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
            <Label htmlFor="dash-eval-notes">Notes</Label>
            <AutoTextarea
              id="dash-eval-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="What went well, what to work on next…"
              data-test="dashboard-evaluation-notes-input"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving} data-test="dashboard-evaluation-submit">
              {isSaving ? 'Saving…' : 'Save evaluation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
