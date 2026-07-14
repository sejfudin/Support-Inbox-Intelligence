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

export function InternMentorControls({ intern, className }) {
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
    <InternPanel className={cn('flex flex-col', className)}>
      <h3 className="text-lg font-semibold text-foreground">Programme controls</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Update the lifecycle status for this intern. The ready status marks them as ready for
        placement.
      </p>
      <div className="mt-5 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="intern-status-select">Lifecycle status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger
              id="intern-status-select"
              className="w-full"
              data-test="intern-status-select"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INTERN_STATUSES.map((s) => (
                <SelectItem key={s} value={s} data-test={`intern-status-${s}`}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          className="w-full"
          disabled={isPending}
          onClick={handleSave}
          data-test="intern-mentor-controls-save-button"
        >
          {isPending ? 'Saving...' : 'Save changes'}
        </Button>
      </div>
    </InternPanel>
  );
}
