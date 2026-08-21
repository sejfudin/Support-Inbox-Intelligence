import { describe, it, expect } from 'vitest';
import { isAssessedLevel, UNASSESSED_LEVEL } from './internProfile';

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
