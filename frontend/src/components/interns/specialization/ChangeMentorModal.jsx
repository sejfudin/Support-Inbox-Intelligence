import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useChangeSpecializationMentor } from '@/queries/specializations';
import { useMentorCandidates } from '@/queries/users';

/**
 * `open` defaults to "there is a record to act on", which is how the
 * Specialization tab drives this — it holds one nullable target and lets that
 * double as the open flag. A caller that always has its record on hand (an
 * intern's own profile) passes `open` separately instead, so it does not have to
 * blank out the record it is still displaying just to close the dialog.
 */
export function ChangeMentorModal({ specialization, onClose, open = Boolean(specialization) }) {
  const [mentorId, setMentorId] = useState('');
  const [error, setError] = useState('');

  const { data: mentorsData } = useMentorCandidates({ hubScoped: false });
  const mentors = mentorsData?.users ?? [];
  const changeMentorMutation = useChangeSpecializationMentor();
  const eligibleMentors = mentors.filter(
    (mentor) => mentor._id !== specialization?.primaryMentor?._id
  );

  const resetAndClose = () => {
    setMentorId('');
    setError('');
    onClose();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    try {
      await changeMentorMutation.mutateAsync({
        internUserId: specialization.user?._id,
        mentorId,
      });
      resetAndClose();
    } catch (submitError) {
      setError(submitError?.response?.data?.message || 'Failed to change mentor.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && resetAndClose()}>
      <DialogContent data-test="change-mentor-dialog">
        <form onSubmit={handleSubmit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Change specialization mentor</DialogTitle>
            <DialogDescription>
              Re-pair {specialization?.user?.fullname || 'this intern'} with a different 1-on-1
              mentor. Their position doesn&apos;t change.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="change-mentor-select">Specialization mentor</Label>
            <Select value={mentorId} onValueChange={setMentorId}>
              <SelectTrigger id="change-mentor-select" data-test="change-mentor-select">
                <SelectValue placeholder="Select a mentor" />
              </SelectTrigger>
              <SelectContent>
                {eligibleMentors.map((mentor) => (
                  <SelectItem
                    key={mentor._id}
                    value={mentor._id}
                    data-test={`change-mentor-option-${mentor._id}`}
                  >
                    {mentor.fullname}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <p
              className="text-sm text-[hsl(var(--tone-danger-fg))]"
              data-test="change-mentor-error"
            >
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={resetAndClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!mentorId || changeMentorMutation.isPending}
              data-test="change-mentor-submit-button"
            >
              {changeMentorMutation.isPending ? 'Saving...' : 'Change mentor'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
