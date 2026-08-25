// Pure rules for intern specialization decisions (swap, validation, lock). No
// I/O, no clock — `assignedAt` is always passed in so callers control the
// timestamp and this stays trivially unit-testable.

const SLOTS = ['main', 'secondary'];

// The two mentor slots on an InternProfile (`primaryMentor`/`secondaryMentor`)
// may never hold the same person. Shared in both directions: this file checks
// it when setting `secondaryMentor`, and `internService.js#transferPrimaryMentor`
// checks it when setting `primaryMentor` — one predicate so a change to the
// rule can't update one direction and miss the other.
const mentorSlotsCollide = (candidateId, otherMentorId) =>
  Boolean(otherMentorId) && String(candidateId) === String(otherMentorId);

// Confirming a specialization decision. `slot === 'secondary'` swaps the
// confirmed position into `declaredPosition` and the old main into
// `secondaryPosition`; `slot === 'main'` keeps both positions as-is. Returns
// the field-change set to persist, or throws on an invalid decision.
const applySpecialization = (profile, { slot, mentorId, assignedAt }) => {
  if (!SLOTS.includes(slot)) {
    throw new Error(`Invalid slot: ${slot}`);
  }
  if (slot === 'secondary' && !profile.secondaryPosition) {
    throw new Error('Cannot confirm secondary specialization: no secondary position set');
  }
  if (!mentorId) {
    throw new Error('mentorId is required');
  }
  if (mentorSlotsCollide(mentorId, profile.primaryMentor)) {
    throw new Error('Secondary mentor must differ from primary mentor');
  }

  const swap = slot === 'secondary';

  return {
    declaredPosition: swap ? profile.secondaryPosition : profile.declaredPosition,
    secondaryPosition: swap ? profile.declaredPosition : profile.secondaryPosition,
    secondaryMentor: mentorId,
    specializationAssignedAt: assignedAt,
  };
};

// Correcting an already-assigned specialization to the intern's other
// position. Swaps declaredPosition/secondaryPosition again; mentor and the
// assigned timestamp are untouched (this isn't a new assignment).
const reassignSpecialization = (profile) => {
  if (!profile.secondaryPosition) {
    throw new Error('Cannot reassign specialization: intern has no secondary position');
  }
  return {
    declaredPosition: profile.secondaryPosition,
    secondaryPosition: profile.declaredPosition,
  };
};

// Re-pairing an already-specialized intern with a different mentor, without
// touching either position.
const changeSpecializationMentor = (profile, { mentorId }) => {
  if (!mentorId) {
    throw new Error('mentorId is required');
  }
  if (mentorSlotsCollide(mentorId, profile.primaryMentor)) {
    throw new Error('Secondary mentor must differ from primary mentor');
  }
  return { secondaryMentor: mentorId };
};

// Undoing a specialization decision. Positions are NOT moved back — only the
// mentor assignment and the lock marker are cleared.
const clearSpecialization = () => ({
  secondaryMentor: null,
  specializationAssignedAt: null,
});

// Once a specialization decision is locked in (`specializationAssignedAt`
// set), the intern can no longer self-edit their declared position.
const canInternEditDeclaredPosition = (profile) => !profile.specializationAssignedAt;

module.exports = {
  applySpecialization,
  reassignSpecialization,
  changeSpecializationMentor,
  clearSpecialization,
  canInternEditDeclaredPosition,
  mentorSlotsCollide,
};
