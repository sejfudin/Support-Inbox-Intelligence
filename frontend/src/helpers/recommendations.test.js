import { describe, it, expect } from 'vitest';
import { recommendationProjectLabel } from './recommendations';

describe('recommendationProjectLabel', () => {
  it('returns the project name when known', () => {
    expect(recommendationProjectLabel({ project: { name: 'Aurora' } })).toBe('Aurora');
  });

  it('returns "Not known yet" when the project is null', () => {
    expect(recommendationProjectLabel({ project: null })).toBe('Not known yet');
  });

  it('returns "Not known yet" when the project is missing entirely', () => {
    expect(recommendationProjectLabel({})).toBe('Not known yet');
  });
});
