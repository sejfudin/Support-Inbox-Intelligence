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
import { InternPanel } from '@/components/interns/InternPanel';
import { INTERN_STATUSES } from '@/helpers/internProfile';
import { useUpdateIntern } from '@/queries/interns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function InternProgrammeControls({ intern, className }) {
  const userId = intern.user?._id || intern.user;
  const { mutate, isPending } = useUpdateIntern();
  const [status, setStatus] = useState(intern.status);

  useEffect(() => {
    setStatus(intern.status);
  }, [intern.status]);

  const handleSave = () => {
    mutate(
      {
        userId,
        payload: { status },
      },
      {
        onSuccess: () => toast.success('Intern profile updated'),
        onError: (err) =>
          toast.error(err?.response?.data?.message || 'Failed to update intern profile'),
      }
    );
  };

  return (
    <InternPanel dense className={cn('flex flex-col', className)}>
      <h3 className="app-card-title">Programme controls</h3>
      <p className="mt-0.5 text-[12.5px] leading-[1.5] text-muted-foreground">
        Update the lifecycle status for this intern. Ready marks them as available for placement.
      </p>
      <div className="mt-3 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="intern-status-select" className="text-[11.5px] font-medium">
            Lifecycle status
          </Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger
              id="intern-status-select"
              className="w-full rounded-[var(--r-control)] text-[13px] capitalize"
              data-test="intern-status-select"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INTERN_STATUSES.map((s) => (
                <SelectItem
                  key={s}
                  value={s}
                  className="capitalize"
                  data-test={`intern-status-${s}`}
                >
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          className="w-full rounded-[var(--r-control)] text-[12.5px]"
          disabled={isPending}
          onClick={handleSave}
          data-test="intern-programme-controls-save-button"
        >
          {isPending ? 'Saving...' : 'Save changes'}
        </Button>
      </div>
    </InternPanel>
  );
}
