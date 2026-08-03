const {
  applySpecialization,
  clearSpecialization,
  canInternEditDeclaredPosition,
} = require('./specializationRules');

const PRIMARY_MENTOR = 'mentor-primary';
const SECONDARY_MENTOR = 'mentor-secondary';
const MAIN_POSITION = 'position-main';
const SECONDARY_POSITION = 'position-secondary';
const ASSIGNED_AT = new Date('2026-01-05T00:00:00.000Z');

const baseProfile = (overrides = {}) => ({
  primaryMentor: PRIMARY_MENTOR,
  declaredPosition: MAIN_POSITION,
  secondaryPosition: SECONDARY_POSITION,
  ...overrides,
});

describe('applySpecialization', () => {
  it('confirms the main slot without swapping positions', () => {
    const profile = baseProfile();
    expect(
      applySpecialization(profile, {
        slot: 'main',
        mentorId: SECONDARY_MENTOR,
        assignedAt: ASSIGNED_AT,
      })
    ).toEqual({
      declaredPosition: MAIN_POSITION,
      secondaryPosition: SECONDARY_POSITION,
      secondaryMentor: SECONDARY_MENTOR,
      specializationAssignedAt: ASSIGNED_AT,
    });
  });

  it('confirms the secondary slot by swapping it into declaredPosition', () => {
    const profile = baseProfile();
    expect(
      applySpecialization(profile, {
        slot: 'secondary',
        mentorId: SECONDARY_MENTOR,
        assignedAt: ASSIGNED_AT,
      })
    ).toEqual({
      declaredPosition: SECONDARY_POSITION,
      secondaryPosition: MAIN_POSITION,
      secondaryMentor: SECONDARY_MENTOR,
      specializationAssignedAt: ASSIGNED_AT,
    });
  });

  it('rejects the secondary slot when there is no secondary position', () => {
    const profile = baseProfile({ secondaryPosition: null });
    expect(() =>
      applySpecialization(profile, {
        slot: 'secondary',
        mentorId: SECONDARY_MENTOR,
        assignedAt: ASSIGNED_AT,
      })
    ).toThrow();
  });

  it('rejects a mentor equal to the primary mentor', () => {
    const profile = baseProfile();
    expect(() =>
      applySpecialization(profile, {
        slot: 'main',
        mentorId: PRIMARY_MENTOR,
        assignedAt: ASSIGNED_AT,
      })
    ).toThrow();
  });

  it('rejects a missing mentor', () => {
    const profile = baseProfile();
    expect(() =>
      applySpecialization(profile, { slot: 'main', mentorId: null, assignedAt: ASSIGNED_AT })
    ).toThrow();
  });

  it('rejects an invalid slot', () => {
    const profile = baseProfile();
    expect(() =>
      applySpecialization(profile, {
        slot: 'tertiary',
        mentorId: SECONDARY_MENTOR,
        assignedAt: ASSIGNED_AT,
      })
    ).toThrow();
  });
});

describe('clearSpecialization', () => {
  it('nulls the mentor and marker without moving positions', () => {
    expect(clearSpecialization()).toEqual({
      secondaryMentor: null,
      specializationAssignedAt: null,
    });
  });
});

describe('canInternEditDeclaredPosition', () => {
  it('is true when no specialization has been assigned', () => {
    expect(canInternEditDeclaredPosition(baseProfile({ specializationAssignedAt: null }))).toBe(
      true
    );
  });

  it('is false once a specialization has been assigned', () => {
    expect(
      canInternEditDeclaredPosition(baseProfile({ specializationAssignedAt: ASSIGNED_AT }))
    ).toBe(false);
  });
});
