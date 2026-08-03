// Pure rules for intern specialization decisions (swap, validation, lock). No
// I/O, no clock — `assignedAt` is always passed in so callers control the
// timestamp and this stays trivially unit-testable.

const SLOTS = ['main', 'secondary'];

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
  if (String(mentorId) === String(profile.primaryMentor)) {
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
  clearSpecialization,
  canInternEditDeclaredPosition,
};
