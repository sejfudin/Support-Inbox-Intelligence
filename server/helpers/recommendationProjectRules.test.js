const {
  assertProjectFieldAsserted,
  assertCanEditProject,
} = require('./recommendationProjectRules');

describe('assertProjectFieldAsserted', () => {
  it('accepts an explicit project id', () => {
    expect(() => assertProjectFieldAsserted('project-1')).not.toThrow();
  });

  it('accepts an explicit null (unknown)', () => {
    expect(() => assertProjectFieldAsserted(null)).not.toThrow();
  });

  it('rejects an omitted field', () => {
    expect(() => assertProjectFieldAsserted(undefined)).toThrow(
      'Project must be set or explicitly marked unknown'
    );
  });
});

describe('assertCanEditProject', () => {
  it('allows setting, swapping and clearing while recommended', () => {
    expect(() =>
      assertCanEditProject({
        status: 'recommended',
        currentProjectId: 'project-1',
        nextProjectId: null,
      })
    ).not.toThrow();
    expect(() =>
      assertCanEditProject({
        status: 'recommended',
        currentProjectId: 'project-1',
        nextProjectId: 'project-2',
      })
    ).not.toThrow();
  });

  it('allows setting, swapping and clearing while interviewing', () => {
    expect(() =>
      assertCanEditProject({
        status: 'interviewing',
        currentProjectId: null,
        nextProjectId: 'project-1',
      })
    ).not.toThrow();
    expect(() =>
      assertCanEditProject({
        status: 'interviewing',
        currentProjectId: 'project-1',
        nextProjectId: null,
      })
    ).not.toThrow();
  });

  it('allows filling in a previously unknown project once resulted', () => {
    expect(() =>
      assertCanEditProject({
        status: 'resulted',
        currentProjectId: null,
        nextProjectId: 'project-1',
      })
    ).not.toThrow();
  });

  it('refuses clearing a known project once resulted', () => {
    expect(() =>
      assertCanEditProject({
        status: 'resulted',
        currentProjectId: 'project-1',
        nextProjectId: null,
      })
    ).toThrow('Project is locked once a recommendation is resulted');
  });

  it('refuses swapping a known project once resulted', () => {
    expect(() =>
      assertCanEditProject({
        status: 'resulted',
        currentProjectId: 'project-1',
        nextProjectId: 'project-2',
      })
    ).toThrow('Project is locked once a recommendation is resulted');
  });

  it('is a no-op when the project is unchanged once resulted', () => {
    expect(() =>
      assertCanEditProject({
        status: 'resulted',
        currentProjectId: 'project-1',
        nextProjectId: 'project-1',
      })
    ).not.toThrow();
    expect(() =>
      assertCanEditProject({
        status: 'resulted',
        currentProjectId: null,
        nextProjectId: null,
      })
    ).not.toThrow();
  });
});
