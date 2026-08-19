import { describe, it, expect } from 'vitest';
import { resolveUserId } from './userIdentity';

describe('resolveUserId', () => {
  it('reads a Mongo document', () => {
    expect(resolveUserId({ _id: 'abc' })).toBe('abc');
  });

  it('reads an auth payload', () => {
    expect(resolveUserId({ id: 'abc' })).toBe('abc');
  });

  it('prefers _id when a payload carries both', () => {
    expect(resolveUserId({ _id: 'mongo', id: 'auth' })).toBe('mongo');
  });

  it('passes an unpopulated ref through', () => {
    expect(resolveUserId('abc')).toBe('abc');
  });

  it('is null for anything with no id, never undefined', () => {
    expect(resolveUserId(null)).toBeNull();
    expect(resolveUserId(undefined)).toBeNull();
    expect(resolveUserId({})).toBeNull();
    expect(resolveUserId({ fullName: 'No id here' })).toBeNull();
  });
});
