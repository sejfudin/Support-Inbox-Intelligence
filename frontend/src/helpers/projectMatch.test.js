import { describe, expect, it } from 'vitest';
import { matchProjectsByName } from './projectMatch';

const project = (name, _id = name) => ({ _id, name });

describe('matchProjectsByName', () => {
  it('ranks an exact match first', () => {
    const matches = matchProjectsByName('Kestrel', [project('Northwind'), project('Kestrel')]);
    expect(matches[0].project.name).toBe('Kestrel');
  });

  it('surfaces a close typo above an unrelated name', () => {
    const matches = matchProjectsByName('Kestral', [project('Northwind'), project('Kestrel')]);
    expect(matches[0].project.name).toBe('Kestrel');
  });

  it('surfaces a substring match highly', () => {
    const matches = matchProjectsByName('Kestrel Fintech', [project('Kestrel')]);
    expect(matches).toHaveLength(1);
  });

  it('excludes names below the score threshold', () => {
    const matches = matchProjectsByName('Kestrel', [project('Zephyr Logistics')]);
    expect(matches).toHaveLength(0);
  });

  it('returns nothing for a blank query', () => {
    expect(matchProjectsByName('   ', [project('Kestrel')])).toEqual([]);
  });
});
