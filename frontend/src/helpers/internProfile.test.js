import { describe, it, expect } from 'vitest';
import {
  getSpecializationAction,
  isAssessedLevel,
  isSpecialized,
  SPECIALIZATION_ACTIONS,
  UNASSESSED_LEVEL,
} from './internProfile';

describe('isAssessedLevel', () => {
  it('treats the unassessed sentinel as not assessed', () => {
    expect(isAssessedLevel(UNASSESSED_LEVEL)).toBe(false);
  });

  it('treats a missing level as not assessed', () => {
    expect(isAssessedLevel(undefined)).toBe(false);
    expect(isAssessedLevel(null)).toBe(false);
    expect(isAssessedLevel('')).toBe(false);
  });

  it('counts the levels a mentor can record', () => {
    expect(isAssessedLevel('learning')).toBe(true);
    expect(isAssessedLevel('ready')).toBe(true);
  });

  // The safe direction: a level nobody has taught this helper about is assessed,
  // so a new one does not silently read as "not assessed yet".
  it('counts an unknown future level as assessed', () => {
    expect(isAssessedLevel('blocked')).toBe(true);
  });
});

describe('isSpecialized', () => {
  it('reads the assigned marker, not the position', () => {
    expect(isSpecialized({ specializationAssignedAt: '2026-01-01' })).toBe(true);
    expect(isSpecialized({ declaredPosition: { _id: 'p1' } })).toBe(false);
  });

  it('treats a missing record as not specialized', () => {
    expect(isSpecialized(null)).toBe(false);
    expect(isSpecialized(undefined)).toBe(false);
    expect(isSpecialized({})).toBe(false);
  });
});

describe('getSpecializationAction', () => {
  const specialized = {
    declaredPosition: { _id: 'p1', name: 'Security Engineer' },
    specializationAssignedAt: '2026-08-24T08:20:45.833Z',
  };

  it('offers the mentor swap once a specialization is assigned', () => {
    expect(getSpecializationAction(specialized)).toBe(SPECIALIZATION_ACTIONS.CHANGE_MENTOR);
  });

  it('offers the assign action to an intern who declared a position', () => {
    expect(getSpecializationAction({ declaredPosition: { _id: 'p1', name: 'QA' } })).toBe(
      SPECIALIZATION_ACTIONS.ASSIGN
    );
  });

  it('blocks the assign action until the intern declares a position', () => {
    expect(getSpecializationAction({ declaredPosition: null })).toBe(
      SPECIALIZATION_ACTIONS.BLOCKED
    );
  });

  // A specialization cannot exist without a position, so this pairing is data
  // corruption rather than a state to design for. The marker still wins: the
  // record says a specialization exists, and its mentor stays changeable.
  it('trusts the marker over a missing position', () => {
    expect(
      getSpecializationAction({ declaredPosition: null, specializationAssignedAt: '2026-01-01' })
    ).toBe(SPECIALIZATION_ACTIONS.CHANGE_MENTOR);
  });

  it('blocks when there is no intern record yet', () => {
    expect(getSpecializationAction(null)).toBe(SPECIALIZATION_ACTIONS.BLOCKED);
    expect(getSpecializationAction(undefined)).toBe(SPECIALIZATION_ACTIONS.BLOCKED);
  });
});
