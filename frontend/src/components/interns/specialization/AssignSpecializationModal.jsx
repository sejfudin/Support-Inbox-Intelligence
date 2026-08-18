import { useEffect, useMemo, useState } from 'react';
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
import { cn } from '@/lib/utils';
import { useAssignSpecialization, useUnspecializedCandidates } from '@/queries/specializations';
import { useMentorCandidates } from '@/queries/users';

const SLOT_OPTIONS = [
  { value: 'main', label: 'Main position' },
  { value: 'secondary', label: 'Secondary position' },
];

export function AssignSpecializationModal({ open, onClose, initialInternUserId = '' }) {
  const [internUserId, setInternUserId] = useState('');
  const [slot, setSlot] = useState('main');
  const [mentorId, setMentorId] = useState('');
  const [error, setError] = useState('');

  const { data: candidates = [], isPending: candidatesLoading } = useUnspecializedCandidates({
    enabled: open,
  });
  const { data: mentorsData } = useMentorCandidates({ hubScoped: false });
  const mentors = mentorsData?.users ?? [];
  const assignMutation = useAssignSpecialization();

  useEffect(() => {
    if (open && initialInternUserId) {
      setInternUserId(initialInternUserId);
    }
  }, [open, initialInternUserId]);

  const selectedIntern = useMemo(
    () => candidates.find((candidate) => candidate.user?._id === internUserId) || null,
    [candidates, internUserId]
  );

  const hasSecondary = Boolean(selectedIntern?.secondaryPosition);
  const canAssign = Boolean(selectedIntern?.declaredPosition);

  // A mentor must differ from the intern's primary mentor — filter it out
  // rather than let the submit round-trip to the server just to fail.
  const eligibleMentors = mentors.filter(
    (mentor) => mentor._id !== selectedIntern?.primaryMentor?._id
  );

  const resetAndClose = () => {
    setInternUserId('');
    setSlot('main');
    setMentorId('');
    setError('');
    onClose();
  };

  const handleInternChange = (nextInternUserId) => {
    setInternUserId(nextInternUserId);
    setSlot('main');
    setMentorId('');
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    try {
      await assignMutation.mutateAsync({ internUserId, slot, mentorId });
      resetAndClose();
    } catch (submitError) {
      setError(submitError?.response?.data?.message || 'Failed to assign specialization.');
    }
  };

  const submitDisabled = !internUserId || !canAssign || !mentorId || assignMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && resetAndClose()}>
      <DialogContent data-test="assign-specialization-dialog">
        <form onSubmit={handleSubmit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Assign specialization</DialogTitle>
            <DialogDescription>
              Confirm one of the intern's declared positions and pair them with a mentor.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="specialization-intern">Intern</Label>
            <Select value={internUserId} onValueChange={handleInternChange}>
              <SelectTrigger id="specialization-intern" data-test="specialization-intern-select">
                <SelectValue
                  placeholder={candidatesLoading ? 'Loading interns...' : 'Select an intern'}
                />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((candidate) => (
                  <SelectItem
                    key={candidate.user?._id}
                    value={candidate.user?._id}
                    disabled={!candidate.declaredPosition}
                    data-test={`specialization-intern-option-${candidate.user?._id}`}
                  >
                    {candidate.user?.fullname || 'Unknown'}
                    {!candidate.declaredPosition ? ' (no position declared yet)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedIntern && (
            <div className="space-y-2">
              <Label htmlFor="specialization-slot">Confirm position</Label>
              <Select value={slot} onValueChange={setSlot}>
                <SelectTrigger id="specialization-slot" data-test="specialization-slot-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SLOT_OPTIONS.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      disabled={option.value === 'secondary' && !hasSecondary}
                    >
                      {option.value === 'main'
                        ? selectedIntern.declaredPosition?.name || option.label
                        : selectedIntern.secondaryPosition?.name || option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="specialization-mentor">Specialization mentor</Label>
            <Select value={mentorId} onValueChange={setMentorId}>
              <SelectTrigger id="specialization-mentor" data-test="specialization-mentor-select">
                <SelectValue placeholder="Select a mentor" />
              </SelectTrigger>
              <SelectContent>
                {eligibleMentors.map((mentor) => (
                  <SelectItem
                    key={mentor._id}
                    value={mentor._id}
                    data-test={`specialization-mentor-option-${mentor._id}`}
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
              data-test="specialization-form-error"
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
              disabled={submitDisabled}
              className={cn(submitDisabled && 'cursor-not-allowed opacity-60')}
              data-test="specialization-submit-button"
            >
              {assignMutation.isPending ? 'Assigning...' : 'Assign specialization'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
