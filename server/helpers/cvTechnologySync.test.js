const { reconcileCvTechnologies } = require('./cvTechnologySync');

// Stand-ins for Technology docs; the helper only cares about `_id`.
const react = { _id: 'react-id', name: 'React', slug: 'react' };
const node = { _id: 'node-id', name: 'Node.js', slug: 'node-js' };
const vue = { _id: 'vue-id', name: 'Vue.js', slug: 'vue-js' };
const python = { _id: 'python-id', name: 'Python', slug: 'python' };

describe('reconcileCvTechnologies', () => {
  it('adds everything on a first scan and records it as CV-owned', () => {
    const result = reconcileCvTechnologies({
      selfTechnologies: [],
      cvTechnologies: [],
      matched: [react, node],
    });

    expect(result.selfTechnologies).toEqual(['react-id', 'node-id']);
    expect(result.cvTechnologies).toEqual(['react-id', 'node-id']);
    expect(result.addedTechnologies).toEqual([react, node]);
    expect(result.removedTechnologyIds).toEqual([]);
  });

  it('replaces the previous scan on re-upload', () => {
    const result = reconcileCvTechnologies({
      selfTechnologies: ['react-id', 'node-id'],
      cvTechnologies: ['react-id', 'node-id'],
      matched: [vue],
    });

    expect(result.selfTechnologies).toEqual(['vue-id']);
    expect(result.cvTechnologies).toEqual(['vue-id']);
    expect(result.addedTechnologies).toEqual([vue]);
    expect(result.removedTechnologyIds).toEqual(['react-id', 'node-id']);
  });

  it('keeps technologies both CVs mention, without re-adding them', () => {
    const result = reconcileCvTechnologies({
      selfTechnologies: ['react-id', 'node-id'],
      cvTechnologies: ['react-id', 'node-id'],
      matched: [react, vue],
    });

    expect(result.selfTechnologies).toEqual(['react-id', 'vue-id']);
    expect(result.cvTechnologies).toEqual(['react-id', 'vue-id']);
    expect(result.addedTechnologies).toEqual([vue]);
    expect(result.removedTechnologyIds).toEqual(['node-id']);
  });

  it('never removes a manual declaration the new CV omits', () => {
    const result = reconcileCvTechnologies({
      selfTechnologies: ['python-id', 'react-id'],
      cvTechnologies: ['react-id'],
      matched: [vue],
    });

    expect(result.selfTechnologies).toEqual(['python-id', 'vue-id']);
    expect(result.cvTechnologies).toEqual(['vue-id']);
    expect(result.removedTechnologyIds).toEqual(['react-id']);
  });

  it('leaves a manually declared technology intern-owned even when a scan matches it', () => {
    // Declared by hand first, then a CV mentions it: the scan must not take ownership...
    const first = reconcileCvTechnologies({
      selfTechnologies: ['python-id'],
      cvTechnologies: [],
      matched: [python, react],
    });

    expect(first.selfTechnologies).toEqual(['python-id', 'react-id']);
    expect(first.cvTechnologies).toEqual(['react-id']);
    expect(first.addedTechnologies).toEqual([react]);

    // ...so a later CV that drops both only takes back the one the scan added.
    const second = reconcileCvTechnologies({
      selfTechnologies: first.selfTechnologies,
      cvTechnologies: first.cvTechnologies,
      matched: [],
    });

    expect(second.selfTechnologies).toEqual(['python-id']);
    expect(second.cvTechnologies).toEqual([]);
    expect(second.removedTechnologyIds).toEqual(['react-id']);
  });

  it('clears the previous scan when the new CV matches nothing', () => {
    const result = reconcileCvTechnologies({
      selfTechnologies: ['react-id'],
      cvTechnologies: ['react-id'],
      matched: [],
    });

    expect(result.selfTechnologies).toEqual([]);
    expect(result.cvTechnologies).toEqual([]);
    expect(result.removedTechnologyIds).toEqual(['react-id']);
  });

  it('is a no-op when the same CV is uploaded twice', () => {
    const result = reconcileCvTechnologies({
      selfTechnologies: ['react-id', 'node-id'],
      cvTechnologies: ['react-id', 'node-id'],
      matched: [react, node],
    });

    expect(result.selfTechnologies).toEqual(['react-id', 'node-id']);
    expect(result.cvTechnologies).toEqual(['react-id', 'node-id']);
    expect(result.addedTechnologies).toEqual([]);
    expect(result.removedTechnologyIds).toEqual([]);
  });

  it('re-adds a technology the intern deleted by hand if the CV still mentions it', () => {
    // updateSelfTechnologies prunes cvTechnologies on a manual removal, so the tech is no
    // longer CV-owned — the next scan treats it as a fresh add.
    const result = reconcileCvTechnologies({
      selfTechnologies: [],
      cvTechnologies: [],
      matched: [react],
    });

    expect(result.selfTechnologies).toEqual(['react-id']);
    expect(result.addedTechnologies).toEqual([react]);
  });

  it('handles populated docs and ObjectId-like values on both profile fields', () => {
    const result = reconcileCvTechnologies({
      selfTechnologies: [{ _id: 'react-id', name: 'React' }, { toString: () => 'node-id' }],
      cvTechnologies: [{ _id: 'node-id' }],
      matched: [react],
    });

    expect(result.selfTechnologies).toEqual(['react-id']);
    expect(result.cvTechnologies).toEqual([]);
    expect(result.removedTechnologyIds).toEqual(['node-id']);
  });

  it('drops duplicate refs left behind by legacy data', () => {
    const result = reconcileCvTechnologies({
      selfTechnologies: ['react-id', 'react-id', 'python-id'],
      cvTechnologies: [],
      matched: [],
    });

    expect(result.selfTechnologies).toEqual(['react-id', 'python-id']);
  });
});
