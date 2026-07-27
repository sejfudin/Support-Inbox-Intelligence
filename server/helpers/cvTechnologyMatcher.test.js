const { matchTechnologiesInText } = require('./cvTechnologyMatcher');
const { slugify } = require('./slugify');
const DEFAULT_TECHNOLOGIES = require('../seeder/defaultTechnologies');

// The catalog as it reaches the matcher at runtime: resolved slug + name, same rule
// seeder/referenceData.js uses.
const CATALOG = DEFAULT_TECHNOLOGIES.map((entry, index) => ({
  _id: `id-${index}`,
  name: entry.name,
  slug: entry.slug || slugify(entry.name),
}));

const slugsIn = (text, catalog = CATALOG) =>
  matchTechnologiesInText(text, catalog).map((t) => t.slug);

// A skills list containing every catalog name — commas give the ambiguous one-letter names
// ("C", "R", "Go") the list context they require.
const FULL_SKILLS_LIST = `Skills: ${CATALOG.map((t) => t.name).join(', ')}.`;

describe('catalog coverage', () => {
  it('recognizes every technology in the default catalog from its own name', () => {
    const found = new Set(slugsIn(FULL_SKILLS_LIST));
    const missing = CATALOG.filter((t) => !found.has(t.slug)).map((t) => t.slug);
    expect(missing).toEqual([]);
  });

  it('has no duplicate slugs', () => {
    const slugs = CATALOG.map((t) => t.slug);
    expect(slugs).toHaveLength(new Set(slugs).size);
  });
});

describe('a realistic CV', () => {
  const CV = `
    Jane Doe — Junior Software Engineer

    TECHNICAL SKILLS
    Languages: JavaScript, TypeScript, Python, Java, C++, SQL
    Frontend: React, Next.js, Redux, Tailwind CSS, HTML5, CSS3
    Backend: Node.js, Express, NestJS, Spring Boot
    Databases: PostgreSQL, MongoDB, Redis
    DevOps: Docker, Kubernetes, AWS, GitHub Actions, Terraform, Linux
    Testing: Jest, Cypress, Playwright, Postman

    EXPERIENCE
    Built REST APIs with Express and Mongoose, containerized with Docker and deployed
    to AWS. Wrote end-to-end tests in Cypress.
  `;

  it('lists technologies well beyond the original catalog', () => {
    const found = slugsIn(CV);
    expect(found).toEqual(
      expect.arrayContaining([
        'javascript',
        'typescript',
        'python',
        'java',
        'cpp',
        'sql',
        'react',
        'next-js',
        'redux',
        'tailwind-css',
        'html',
        'css',
        'node-js',
        'express-js',
        'nestjs',
        'spring-boot',
        'postgresql',
        'mongodb',
        'redis',
        'docker',
        'kubernetes',
        'aws',
        'github-actions',
        'terraform',
        'linux',
        'jest',
        'cypress',
        'playwright',
        'postman',
      ])
    );
  });

  it('does not invent technologies the CV never mentions', () => {
    const found = slugsIn(CV);
    expect(found).not.toContain('flutter');
    expect(found).not.toContain('laravel');
    expect(found).not.toContain('tableau');
  });
});

describe('name collisions', () => {
  it('separates Java from JavaScript', () => {
    expect(slugsIn('Skills: JavaScript, TypeScript')).not.toContain('java');
    expect(slugsIn('Skills: Java, Spring Boot')).toContain('java');
  });

  it('separates C, C++ and C#', () => {
    const found = slugsIn('Languages: C, C++, C#, Python');
    expect(found).toContain('c');
    expect(found).toContain('cpp');
    expect(found).toContain('csharp');
  });

  it('does not read C out of C++ or C# alone', () => {
    expect(slugsIn('Languages: C++, C#')).not.toContain('c');
  });

  it('separates SQL from the databases whose names end in it', () => {
    const found = slugsIn('Databases: MySQL, PostgreSQL');
    expect(found).toEqual(expect.arrayContaining(['mysql', 'postgresql']));
    expect(found).not.toContain('sql');
  });
});

describe('everyday words that are also technology names', () => {
  it('matches R in a skills list but not R&D in prose', () => {
    expect(slugsIn('Languages: Python, R, SQL')).toContain('r');
    expect(slugsIn('Worked in the R&D department for two years.')).not.toContain('r');
  });

  it('matches Express in a skills list but not "express my interest"', () => {
    expect(slugsIn('Stack: Node.js, Express, MongoDB')).toContain('express-js');
    expect(slugsIn('I would like to express my interest in this internship.')).not.toContain(
      'express-js'
    );
  });

  it('matches Go via golang or a skills list, not "ready to go"', () => {
    expect(slugsIn('Backend: Golang, gRPC')).toContain('go');
    expect(slugsIn('Languages: Java | Go | Rust')).toContain('go');
    expect(slugsIn('I am ready to go the extra mile.')).not.toContain('go');
  });

  it('does not read SolidJS out of SOLID principles', () => {
    expect(slugsIn('I write clean code following SOLID principles.')).not.toContain('solidjs');
    expect(slugsIn('Frontend: SolidJS, Astro')).toContain('solidjs');
  });
});

describe('spelling variants', () => {
  it('matches versioned spellings', () => {
    expect(slugsIn('Skills: HTML5, CSS3, Python3')).toEqual(
      expect.arrayContaining(['html', 'css', 'python'])
    );
  });

  it('matches vendor and short forms', () => {
    expect(slugsIn('Cloud: Amazon Web Services, GCP, Azure')).toEqual(
      expect.arrayContaining(['aws', 'google-cloud', 'azure'])
    );
    expect(slugsIn('Orchestration: k8s')).toContain('kubernetes');
    expect(slugsIn('Data: scikit-learn, sklearn, PySpark')).toEqual(
      expect.arrayContaining(['scikit-learn', 'apache-spark'])
    );
  });

  it('matches names split by unicode dashes and spaces', () => {
    // \u2011 non-breaking hyphen, \u00a0 nbsp — both common in PDF-extracted text. Escaped
    // rather than pasted so the test keeps testing what it says it does.
    const text = 'Mobile: React\u2011Native; Frontend: Tailwind\u00a0CSS, Next\u2011js';
    expect(slugsIn(text)).toEqual(
      expect.arrayContaining(['react-native', 'tailwind-css', 'next-js'])
    );
  });
});

describe('catalog scoping', () => {
  it('never returns a technology outside the catalog it was given', () => {
    const catalog = [{ _id: '1', name: 'React', slug: 'react' }];
    expect(slugsIn('React, Vue.js, Angular, Docker', catalog)).toEqual(['react']);
  });

  it('skips inactive technologies', () => {
    const catalog = [{ _id: '1', name: 'Docker', slug: 'docker', isActive: false }];
    expect(slugsIn('Docker, Kubernetes', catalog)).toEqual([]);
  });

  it('falls back to name matching for an admin-added technology', () => {
    const catalog = [{ _id: '1', name: 'Apache Cassandra', slug: 'apache-cassandra' }];
    expect(slugsIn('Databases: Apache Cassandra', catalog)).toEqual(['apache-cassandra']);
  });

  it('returns nothing for empty or unreadable text', () => {
    expect(matchTechnologiesInText('', CATALOG)).toEqual([]);
    expect(matchTechnologiesInText(null, CATALOG)).toEqual([]);
    expect(matchTechnologiesInText(undefined, CATALOG)).toEqual([]);
  });
});
