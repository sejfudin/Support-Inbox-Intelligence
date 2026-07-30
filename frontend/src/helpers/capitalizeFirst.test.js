import { describe, it, expect } from 'vitest';
import { capitalizeFirst } from './capitalizeFirst';

describe('capitalizeFirst', () => {
  it('capitalizes the first letter and lowercases the rest', () => {
    expect(capitalizeFirst('hELLO')).toBe('Hello');
  });

  it('returns an empty string for non-string input', () => {
    expect(capitalizeFirst(null)).toBe('');
    expect(capitalizeFirst(undefined)).toBe('');
  });
});
