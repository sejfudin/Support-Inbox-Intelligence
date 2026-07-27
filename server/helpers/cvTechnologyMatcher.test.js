const { matchTechnologiesInText, TECHNOLOGY_ALIASES } = require('./cvTechnologyMatcher');
const { slugify } = require('./slugify');
const DEFAULT_TECHNOLOGIES = require('../seeder/defaultTechnologies');

// The catalog exactly as referenceData.js seeds it, so these tests fail if a technology is
// added to the seed list without a matching alias entry (the bug that made a clean frontend
// CV yield only "React").
const CATALOG = DEFAULT_TECHNOLOGIES.map((entry, index) => ({
  _id: `tech-${index}`,
  name: entry.name,
  slug: entry.slug || slugify(entry.name),
  isActive: true,
}));

const names = (text, catalog = CATALOG) =>
  matchTechnologiesInText(text, catalog).map((t) => t.name);

// "Go" is deliberately excluded from the name round-trip below: bare "Go" is an everyday
// English word, so SPECIAL_MATCHERS only accepts it next to list punctuation or as "golang".
const SPECIAL_SLUGS = ['go'];

describe('catalog / alias consistency', () => {
  it('gives every seeded technology a curated alias entry', () => {
    const missing = CATALOG.filter(
      (t) => !SPECIAL_SLUGS.includes(t.slug) && !TECHNOLOGY_ALIASES[t.slug]
    ).map((t) => t.slug);
    expect(missing).toEqual([]);
  });

  it('has no alias entry for a slug that is not in the catalog', () => {
    const slugs = new Set(CATALOG.map((t) => t.slug));
    expect(Object.keys(TECHNOLOGY_ALIASES).filter((slug) => !slugs.has(slug))).toEqual([]);
  });

  it('recognizes every technology from its own display name', () => {
    const unmatched = CATALOG.filter(
      (t) => !SPECIAL_SLUGS.includes(t.slug) && !names(t.name).includes(t.name)
    ).map((t) => t.name);
    expect(unmatched).toEqual([]);
  });
});

describe('matchTechnologiesInText — skills sections', () => {
  // Regression: the reported bug returned only "React" from this CV.
  it('picks up every skill in a bulleted frontend skills list', () => {
    const cv = [
      'Alex Morgan — Frontend Developer',
      'Skills',
      '• React',
      '• TypeScript',
      '• JavaScript (ES6+)',
      '• HTML5 / CSS3',
      '• Redux',
      '• Jest',
      '• Git',
    ].join('\n');

    expect(names(cv).sort()).toEqual(
      ['Git', 'HTML & CSS', 'JavaScript', 'Jest', 'React', 'Redux', 'TypeScript'].sort()
    );
  });

  it('picks up a comma-separated backend skills line', () => {
    expect(
      names('Technologies: Java, Spring Boot, PostgreSQL, Docker, Kubernetes, AWS').sort()
    ).toEqual(['AWS', 'Docker', 'Java', 'Kubernetes', 'PostgreSQL', 'Spring Boot'].sort());
  });

  it('reads technologies out of prose, not just skills lists', () => {
    expect(
      names('Built REST endpoints in Python with FastAPI, stored data in MongoDB.').sort()
    ).toEqual(['FastAPI', 'MongoDB', 'Python'].sort());
  });

  it('returns each technology once even when mentioned repeatedly', () => {
    expect(names('React, React.js and ReactJS')).toEqual(['React']);
  });
});

describe('matchTechnologiesInText — spelling variants', () => {
  it.each([
    ['HTML5 / CSS3', 'HTML & CSS'],
    ['SCSS', 'HTML & CSS'],
    ['Python3', 'Python'],
    ['C#', 'C#'],
    ['ES6', 'JavaScript'],
    ['TailwindCSS', 'Tailwind CSS'],
    ['Dockerfile', 'Docker'],
    ['k8s', 'Kubernetes'],
    ['PL/SQL', 'SQL'],
    ['Postgres', 'PostgreSQL'],
    ['Mongoose', 'MongoDB'],
    ['golang', 'Go'],
    ['Languages: Go, Rust', 'Go'],
  ])('matches %s as %s', (text, expected) => {
    expect(names(text)).toContain(expected);
  });
});

describe('matchTechnologiesInText — false positives', () => {
  it.each([
    ['obeyed all laws and regulations', 'AWS'],
    ['managed digital assets', 'Git'],
    ['contributed on GitHub and GitLab', 'Git'],
    ['a trusted teammate', 'Rust'],
    ['used MySQL for reporting', 'SQL'],
    ['built a JavaScript parser', 'Java'],
    ['ready to go the extra mile', 'Go'],
  ])('does not match %s as %s', (text, notExpected) => {
    expect(names(text)).not.toContain(notExpected);
  });

  it('ignores inactive technologies', () => {
    const catalog = [{ _id: '1', name: 'React', slug: 'react', isActive: false }];
    expect(names('React', catalog)).toEqual([]);
  });

  it('returns [] for empty or unreadable text', () => {
    expect(names('')).toEqual([]);
    expect(names(null)).toEqual([]);
  });
});
