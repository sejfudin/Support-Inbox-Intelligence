const { mergeCvTechnologies } = require('./cvTechnologySync');

// Stand-ins for Technology docs; the helper only cares about `_id`.
const react = { _id: 'react-id', name: 'React', slug: 'react' };
const node = { _id: 'node-id', name: 'Node.js', slug: 'node-js' };
const vue = { _id: 'vue-id', name: 'Vue.js', slug: 'vue-js' };

describe('mergeCvTechnologies', () => {
  it('adds everything on a first scan', () => {
    const result = mergeCvTechnologies({ selfTechnologies: [], matched: [react, node] });

    expect(result.selfTechnologies).toEqual(['react-id', 'node-id']);
    expect(result.addedTechnologies).toEqual([react, node]);
  });

  it('adds a re-upload’s technologies on top of the existing list', () => {
    const result = mergeCvTechnologies({
      selfTechnologies: ['react-id', 'node-id'],
      matched: [vue],
    });

    expect(result.selfTechnologies).toEqual(['react-id', 'node-id', 'vue-id']);
    expect(result.addedTechnologies).toEqual([vue]);
  });

  it('keeps a technology the new CV no longer mentions', () => {
    // The whole point: a CV that drops a section, spells a skill differently, or covers only
    // recent work is not the intern saying they lost the rest.
    const result = mergeCvTechnologies({
      selfTechnologies: ['react-id', 'node-id'],
      matched: [react, vue],
    });

    expect(result.selfTechnologies).toEqual(['react-id', 'node-id', 'vue-id']);
    expect(result.addedTechnologies).toEqual([vue]);
  });

  it('changes nothing when a CV matches nothing at all', () => {
    const result = mergeCvTechnologies({
      selfTechnologies: ['react-id', 'python-id'],
      matched: [],
    });

    expect(result.selfTechnologies).toEqual(['react-id', 'python-id']);
    expect(result.addedTechnologies).toEqual([]);
  });

  it('is a no-op when the same CV is uploaded twice', () => {
    const result = mergeCvTechnologies({
      selfTechnologies: ['react-id', 'node-id'],
      matched: [react, node],
    });

    expect(result.selfTechnologies).toEqual(['react-id', 'node-id']);
    expect(result.addedTechnologies).toEqual([]);
  });

  it('re-adds a technology the intern deleted by hand if the CV still mentions it', () => {
    const result = mergeCvTechnologies({ selfTechnologies: ['python-id'], matched: [react] });

    expect(result.selfTechnologies).toEqual(['python-id', 'react-id']);
    expect(result.addedTechnologies).toEqual([react]);
  });

  it('handles populated docs and ObjectId-like values on the profile field', () => {
    const result = mergeCvTechnologies({
      selfTechnologies: [{ _id: 'react-id', name: 'React' }, { toString: () => 'node-id' }],
      matched: [react, vue],
    });

    expect(result.selfTechnologies).toEqual(['react-id', 'node-id', 'vue-id']);
    expect(result.addedTechnologies).toEqual([vue]);
  });

  it('drops duplicate refs left behind by legacy data, and duplicate matches', () => {
    const result = mergeCvTechnologies({
      selfTechnologies: ['react-id', 'react-id', 'python-id'],
      matched: [vue, { ...vue }],
    });

    expect(result.selfTechnologies).toEqual(['react-id', 'python-id', 'vue-id']);
    expect(result.addedTechnologies).toEqual([vue]);
  });
});
