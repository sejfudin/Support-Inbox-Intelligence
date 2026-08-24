import { describe, it, expect } from 'vitest';
import {
  activeUnknownProjectRecommendations,
  recommendationProjectLabel,
} from './recommendations';

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

describe('activeUnknownProjectRecommendations', () => {
  it('keeps active recommendations with no project', () => {
    const recommendations = [
      { status: 'recommended', project: null },
      { status: 'interviewing', project: null },
    ];
    expect(activeUnknownProjectRecommendations(recommendations)).toHaveLength(2);
  });

  it('drops active recommendations that have a known project', () => {
    const recommendations = [{ status: 'recommended', project: { _id: 'p1', name: 'Aurora' } }];
    expect(activeUnknownProjectRecommendations(recommendations)).toEqual([]);
  });

  it('drops recommendations that are no longer active', () => {
    const recommendations = [{ status: 'resulted', project: null }];
    expect(activeUnknownProjectRecommendations(recommendations)).toEqual([]);
  });
});
