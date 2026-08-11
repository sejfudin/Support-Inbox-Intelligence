import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePositions } from '@/queries/positions';
import { useRequestInternsForProject } from '@/queries/projects';

const NOTE_MAX_LENGTH = 500;

const emptyForm = () => ({ positionId: '', count: '', note: '' });

/**
 * Leadership-only: ask admins to staff interns onto a project. Deliberately
 * thin — a note plus optional position/count, notify-only (nothing tracked
 * here beyond the notification admins receive). See projectService.js
 * #requestInternsForProject.
 */
export function RequestInternsModal({ projectId, projectName, open, onClose }) {
  const { data: positions = [] } = usePositions();
  const { mutate: requestInterns, isPending } = useRequestInternsForProject();
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (open) setForm(emptyForm());
  }, [open]);

  const noteTooLong = form.note.length > NOTE_MAX_LENGTH;
  const canSubmit = form.note.trim().length > 0 && !noteTooLong;

  const submit = () => {
    if (!canSubmit) return;
    requestInterns(
      {
        id: projectId,
        data: {
          positionId: form.positionId || undefined,
          count: form.count ? Number(form.count) : undefined,
          note: form.note.trim(),
        },
      },
      {
        onSuccess: () => {
          toast.success('Request sent to the admin team');
          onClose();
        },
        onError: (error) => {
          toast.error(error?.response?.data?.message || 'Could not send the request');
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent data-test="request-interns-modal">
        <DialogHeader>
          <DialogTitle>Request interns</DialogTitle>
          <DialogDescription>
            Let the admin team know what {projectName || 'this project'} needs. This notifies admins
            directly — it isn't tracked anywhere else.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="request-interns-position">Position (optional)</Label>
            <Select
              value={form.positionId}
              onValueChange={(value) => setForm((f) => ({ ...f, positionId: value }))}
            >
              <SelectTrigger id="request-interns-position" data-test="request-interns-position">
                <SelectValue placeholder="Any position" />
              </SelectTrigger>
              <SelectContent>
                {positions.map((position) => (
                  <SelectItem key={position._id} value={position._id}>
                    {position.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="request-interns-count">How many (optional)</Label>
            <Input
              id="request-interns-count"
              data-test="request-interns-count"
              type="number"
              min={1}
              max={50}
              value={form.count}
              onChange={(e) => setForm((f) => ({ ...f, count: e.target.value }))}
              placeholder="e.g. 2"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="request-interns-note">What do you need?</Label>
            <Textarea
              id="request-interns-note"
              data-test="request-interns-note"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="e.g. Need help ramping up the payments API work before Q4."
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              {form.note.length}/{NOTE_MAX_LENGTH}
              {noteTooLong ? ' — too long' : ''}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={!canSubmit || isPending}
            data-test="request-interns-submit"
          >
            {isPending ? 'Sending…' : 'Send request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
