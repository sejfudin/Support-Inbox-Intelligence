const { slugify } = require('./slugify');

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('strips leading/trailing separators', () => {
    expect(slugify('  --Weird Input!!--  ')).toBe('weird-input');
  });
});
