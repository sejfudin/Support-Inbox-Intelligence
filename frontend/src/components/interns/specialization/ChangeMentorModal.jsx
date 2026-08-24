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
 * Explicit primitive props rather than a `specialization` object, on purpose:
 * this modal now has two callers (`SpecializationPage`'s list row, and
 * `InternProfileView`'s full intern record) that carry the needed fields
 * under different backend shapes. Passing primitives means neither caller has
 * to match the other's shape — each maps its own data down to this contract.
 */
export function ChangeMentorModal({
  open,
  internUserId,
  internFullname,
  currentMentorId,
  onClose,
}) {
  const [mentorId, setMentorId] = useState('');
  const [error, setError] = useState('');

  const { data: mentorsData } = useMentorCandidates({ hubScoped: false });
  const mentors = mentorsData?.users ?? [];
  const changeMentorMutation = useChangeSpecializationMentor();

  const eligibleMentors = mentors.filter((mentor) => mentor._id !== currentMentorId);

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
        internUserId,
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
              Re-pair {internFullname || 'this intern'} with a different 1-on-1 mentor. Their
              position doesn&apos;t change.
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
