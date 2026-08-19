import { describe, it, expect } from 'vitest';
import {
  getInitials,
  resolveUserAvatarUrl,
  resolveUserId,
  resolveUserInitials,
  resolveUserName,
} from './userIdentity';

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

describe('resolveUserName', () => {
  it('reads the Mongo field and the auth payload field', () => {
    expect(resolveUserName({ fullname: 'Dario Perić' })).toBe('Dario Perić');
    expect(resolveUserName({ fullName: 'Dario Perić' })).toBe('Dario Perić');
  });

  it('falls back to the email so a nameless account is still recognisable', () => {
    expect(resolveUserName({ email: 'dario@symphony.is' })).toBe('dario@symphony.is');
  });

  it('is an empty string for nothing, never undefined', () => {
    expect(resolveUserName(null)).toBe('');
    expect(resolveUserName({})).toBe('');
  });

  it('passes an unpopulated ref through', () => {
    expect(resolveUserName('some-id')).toBe('some-id');
  });
});

describe('getInitials', () => {
  it('takes the first and last word, so a three-part name gives two letters', () => {
    expect(getInitials('Dario Perić')).toBe('DP');
    // This is the case the three old implementations disagreed on:
    // `helpers/getInitials.js` answered "AM" here and the other two "AP".
    expect(getInitials('Ana Maria Perić')).toBe('AP');
  });

  it('gives a single-word name two letters rather than one', () => {
    expect(getInitials('Madonna')).toBe('MA');
  });

  it('ignores runs of whitespace', () => {
    expect(getInitials('  Dario   Perić  ')).toBe('DP');
  });

  it('returns the fallback when there is no name at all', () => {
    expect(getInitials('')).toBe('?');
    expect(getInitials(null)).toBe('?');
    expect(getInitials(undefined)).toBe('?');
    expect(getInitials('   ')).toBe('?');
    expect(getInitials('', 'L')).toBe('L');
  });
});

describe('resolveUserInitials', () => {
  it('works off whichever name field the user arrived with', () => {
    expect(resolveUserInitials({ fullname: 'Dario Perić' })).toBe('DP');
    expect(resolveUserInitials({ fullName: 'Dario Perić' })).toBe('DP');
  });

  it('uses the fallback for a user with nothing to go on', () => {
    expect(resolveUserInitials(null)).toBe('?');
    expect(resolveUserInitials({}, 'L')).toBe('L');
  });
});

describe('resolveUserAvatarUrl', () => {
  it('returns the URL when the account has a picture', () => {
    expect(resolveUserAvatarUrl({ avatarUrl: 'https://x/y.png' })).toBe('https://x/y.png');
  });

  // `null` is the signal to draw initials instead, so it must never be undefined
  // or an empty string leaking through as a truthy-looking value.
  it('is null for an account with no picture', () => {
    expect(resolveUserAvatarUrl({ fullname: 'Dario Perić' })).toBeNull();
    expect(resolveUserAvatarUrl({ avatarUrl: '' })).toBeNull();
    expect(resolveUserAvatarUrl({ avatarUrl: null })).toBeNull();
    expect(resolveUserAvatarUrl(null)).toBeNull();
  });

  it('is null for an unpopulated ref, which carries no picture', () => {
    expect(resolveUserAvatarUrl('some-id')).toBeNull();
  });
});
