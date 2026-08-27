const {
  LEVEL_ORDER,
  buildTechnologyReadiness,
  buildPositionReadiness,
  summarizeReadiness,
} = require('./readinessSummary');
const { READINESS_LEVELS } = require('../models/ReadinessFlag');

const tech = (id, name, slug = name.toLowerCase()) => ({ _id: id, name, slug });

const techFlag = (technologyId, level, setBy = 'Mentor One') => ({
  technology: { _id: technologyId },
  level,
  setBy: { fullname: setBy },
  updatedAt: new Date('2026-05-01T00:00:00Z'),
});

describe('level vocabulary', () => {
  it('covers exactly the model enum', () => {
    // The model is the schema authority; this file duplicates the three strings so
    // it needs no mongoose. If a fourth level is ever added there, this fails here
    // rather than silently counting it as "none".
    expect([...LEVEL_ORDER].sort()).toEqual([...READINESS_LEVELS].sort());
  });
});

describe('buildTechnologyReadiness', () => {
  // The intern's view lists AI skills under their own heading, so the row has to say which
  // half it came from. A row built from a technology seeded before the field existed carries
  // no category of its own and must still read as general rather than as undefined.
  it('carries the category through, defaulting a catalog row without one to general', () => {
    const rows = buildTechnologyReadiness(
      [{ ...tech('t1', 'Claude Code'), category: 'ai' }, tech('t2', 'React')],
      []
    );

    expect(rows.map((row) => [row.name, row.category])).toEqual([
      ['Claude Code', 'ai'],
      ['React', 'general'],
    ]);
  });

  it('reads a declared technology with no flag as not assessed', () => {
    const rows = buildTechnologyReadiness([tech('t1', 'React')], []);

    expect(rows).toEqual([
      {
        id: 't1',
        name: 'React',
        slug: 'react',
        category: 'general',
        level: 'none',
        assessedBy: null,
        assessedAt: null,
      },
    ]);
  });

  it('joins the flag onto its technology, with who assessed it', () => {
    const [row] = buildTechnologyReadiness([tech('t1', 'React')], [techFlag('t1', 'ready')]);

    expect(row.level).toBe('ready');
    expect(row.assessedBy).toBe('Mentor One');
    expect(row.assessedAt).toEqual(new Date('2026-05-01T00:00:00Z'));
  });

  it('ignores a flag for a technology the intern no longer declares', () => {
    const rows = buildTechnologyReadiness([tech('t1', 'React')], [techFlag('dropped', 'ready')]);

    expect(rows).toHaveLength(1);
    expect(rows[0].level).toBe('none');
  });

  it('sorts ready first, then learning, then unassessed, alphabetically inside each', () => {
    const rows = buildTechnologyReadiness(
      [tech('t1', 'Zod'), tech('t2', 'React'), tech('t3', 'Ansible'), tech('t4', 'Node')],
      [techFlag('t1', 'ready'), techFlag('t2', 'ready'), techFlag('t3', 'learning')]
    );

    expect(rows.map((row) => row.name)).toEqual(['React', 'Zod', 'Ansible', 'Node']);
  });

  it('accepts a flag whose technology is an unpopulated id', () => {
    const [row] = buildTechnologyReadiness(
      [tech('t1', 'React')],
      [{ technology: 't1', level: 'learning', setBy: { fullname: 'Mentor One' } }]
    );

    expect(row.level).toBe('learning');
  });

  it('has nothing to show when the intern has declared nothing', () => {
    expect(buildTechnologyReadiness([], [techFlag('t1', 'ready')])).toEqual([]);
  });
});

describe('buildPositionReadiness', () => {
  const position = { _id: 'p1', name: 'Frontend', slug: 'frontend' };

  it('is null when no position is declared', () => {
    expect(buildPositionReadiness(null, [])).toBeNull();
  });

  it('reads a declared position with no flag as not assessed', () => {
    expect(buildPositionReadiness(position, [])).toEqual({
      id: 'p1',
      name: 'Frontend',
      slug: 'frontend',
      level: 'none',
      assessedBy: null,
      assessedAt: null,
    });
  });

  it('picks the flag targeting that position', () => {
    const flag = {
      position: { _id: 'p1' },
      level: 'ready',
      setBy: { fullname: 'Admin One' },
    };

    expect(buildPositionReadiness(position, [flag])).toMatchObject({
      level: 'ready',
      assessedBy: 'Admin One',
    });
  });

  it('ignores a flag left over from a previous position', () => {
    // A position flag is a singleton that gets rewritten when the declared
    // position changes; carrying an old level onto the new role would tell the
    // intern they are ready for something nobody has assessed.
    const stale = { position: { _id: 'p-old' }, level: 'ready', setBy: { fullname: 'Admin One' } };

    expect(buildPositionReadiness(position, [stale]).level).toBe('none');
  });

  it('ignores technology flags entirely', () => {
    expect(buildPositionReadiness(position, [techFlag('t1', 'ready')]).level).toBe('none');
  });
});

describe('summarizeReadiness', () => {
  it('counts each level, unassessed included', () => {
    const rows = [
      { level: 'ready' },
      { level: 'ready' },
      { level: 'learning' },
      { level: 'none' },
      { level: 'none' },
      { level: 'none' },
    ];

    expect(summarizeReadiness(rows)).toEqual({ total: 6, ready: 2, learning: 1, none: 3 });
  });

  it('is all zeros with no rows', () => {
    expect(summarizeReadiness([])).toEqual({ total: 0, ready: 0, learning: 0, none: 0 });
  });

  it('counts an unrecognised level as unassessed rather than dropping the row', () => {
    expect(summarizeReadiness([{ level: 'bogus' }, {}])).toEqual({
      total: 2,
      ready: 0,
      learning: 0,
      none: 2,
    });
  });
});
