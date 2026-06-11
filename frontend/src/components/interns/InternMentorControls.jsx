import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { InternPanel } from '@/components/interns/InternPanel';
import { INTERN_STATUSES } from '@/helpers/internProfile';
import { useUpdateIntern } from '@/queries/interns';
import { toast } from 'sonner';

export function InternMentorControls({ intern }) {
  const userId = intern.user?._id || intern.user;
  const { mutate, isPending } = useUpdateIntern();
  const [status, setStatus] = useState(intern.status);
  const [readyForPlacement, setReadyForPlacement] = useState(Boolean(intern.readyForPlacement));

  useEffect(() => {
    setStatus(intern.status);
    setReadyForPlacement(Boolean(intern.readyForPlacement));
  }, [intern.status, intern.readyForPlacement]);

  const handleSave = () => {
    mutate(
      {
        userId,
        payload: { status, readyForPlacement },
      },
      {
        onSuccess: () => toast.success('Intern profile updated'),
        onError: (err) =>
          toast.error(err?.response?.data?.message || 'Failed to update intern profile'),
      }
    );
  };

  return (
    <InternPanel>
      <h3 className="text-lg font-semibold text-foreground">Programme controls</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Update lifecycle status and placement readiness for this intern.
      </p>
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="intern-status-select">Lifecycle status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger id="intern-status-select" data-test="intern-status-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INTERN_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value} data-test={`intern-status-${s.value}`}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center justify-between gap-4 rounded-xl border border-border/60 px-4 py-3">
          <div>
            <p className="text-sm font-medium">Ready for placement</p>
            <p className="text-xs text-muted-foreground">Visible to mentors and leadership</p>
          </div>
          <Checkbox
            checked={readyForPlacement}
            onCheckedChange={setReadyForPlacement}
            data-test="intern-ready-for-placement-checkbox"
          />
        </label>
      </div>
      <Button
        type="button"
        className="mt-5"
        disabled={isPending}
        onClick={handleSave}
        data-test="intern-mentor-controls-save-button"
      >
        {isPending ? 'Saving...' : 'Save changes'}
      </Button>
    </InternPanel>
  );
}
