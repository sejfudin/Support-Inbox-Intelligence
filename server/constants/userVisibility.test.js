const { REAL_USER_FILTER, TOMBSTONE_FILTER, isRealUser } = require('./userVisibility');

describe('the filters', () => {
  it('excludes with $ne so documents written before the field existed still match', () => {
    // `isTestAccount: false` would miss every user created before the flag was
    // added, which is most of them.
    expect(REAL_USER_FILTER).toEqual({
      isTestAccount: { $ne: true },
      isTombstone: { $ne: true },
    });
    expect(TOMBSTONE_FILTER).toEqual({ isTombstone: { $ne: true } });
  });

  it('keeps the tombstone excluded even in the widened form', () => {
    // `includeTestAccounts` is about an account an admin manages. There is
    // nothing to manage about the tombstone, so no listing should carry it.
    expect(TOMBSTONE_FILTER).toHaveProperty('isTombstone');
  });

  it('is frozen, so a caller mutating a query cannot rewrite the guard', () => {
    expect(Object.isFrozen(REAL_USER_FILTER)).toBe(true);
    expect(Object.isFrozen(TOMBSTONE_FILTER)).toBe(true);
  });
});

describe('isRealUser', () => {
  it('accepts a person', () => {
    expect(isRealUser({ fullname: 'Dario Perić' })).toBe(true);
    expect(isRealUser({ isTestAccount: false, isTombstone: false })).toBe(true);
  });

  it('rejects both kinds of non-person', () => {
    expect(isRealUser({ isTestAccount: true })).toBe(false);
    expect(isRealUser({ isTombstone: true })).toBe(false);
  });

  it('rejects an absent user, so a guard can ask this one question instead of two', () => {
    expect(isRealUser(null)).toBe(false);
    expect(isRealUser(undefined)).toBe(false);
  });
});
