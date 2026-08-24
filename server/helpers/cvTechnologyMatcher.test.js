const {
  matchTechnologiesInText,
  TECHNOLOGY_ALIASES,
  AMBIGUOUS_MATCHERS,
} = require('./cvTechnologyMatcher');
const { slugify } = require('./slugify');
const DEFAULT_TECHNOLOGIES = require('../seeder/defaultTechnologies');

// The catalog as it reaches the matcher at runtime: resolved slug + name, the same rule
// seeder/referenceData.js uses. Building it from the real seed list means these tests fail if
// a technology is added to the catalog without a matching alias entry — the bug that made a
// clean frontend CV yield only "React".
const CATALOG = DEFAULT_TECHNOLOGIES.map((entry, index) => ({
  _id: `id-${index}`,
  name: entry.name,
  slug: entry.slug || slugify(entry.name),
  isActive: true,
}));

const slugsIn = (text, catalog = CATALOG) =>
  matchTechnologiesInText(text, catalog).map((t) => t.slug);

const names = (text, catalog = CATALOG) =>
  matchTechnologiesInText(text, catalog).map((t) => t.name);

// The everyday-word names ("Go", "C", "R", "Express") deliberately do not match on the bare
// term alone, so they are excluded from the round-trip checks below and covered separately.
const AMBIGUOUS_SLUGS = Object.keys(AMBIGUOUS_MATCHERS);

// A skills list containing every catalog name — the commas give the ambiguous one-letter
// names ("C", "R", "Go") the list context they require.
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

  it('gives every seeded technology a curated alias entry', () => {
    const missing = CATALOG.filter(
      (t) => !AMBIGUOUS_SLUGS.includes(t.slug) && !TECHNOLOGY_ALIASES[t.slug]
    ).map((t) => t.slug);
    expect(missing).toEqual([]);
  });

  // The reverse drift: an alias entry left behind for a slug that was renamed or retired out
  // of the catalog matches nothing at runtime and is dead weight nobody notices.
  it('has no alias entry for a slug that is not in the catalog', () => {
    const slugs = new Set(CATALOG.map((t) => t.slug));
    expect(Object.keys(TECHNOLOGY_ALIASES).filter((slug) => !slugs.has(slug))).toEqual([]);
  });

  it('recognizes every technology from its own display name in isolation', () => {
    const unmatched = CATALOG.filter(
      (t) => !AMBIGUOUS_SLUGS.includes(t.slug) && !names(t.name).includes(t.name)
    ).map((t) => t.name);
    expect(unmatched).toEqual([]);
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

describe('skills sections', () => {
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
      ['CSS', 'Git', 'HTML', 'JavaScript', 'Jest', 'React', 'Redux', 'TypeScript'].sort()
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

  it('separates Git from GitHub, GitLab and ordinary words', () => {
    expect(slugsIn('Tools: Git, Docker')).toContain('git');
    expect(slugsIn('Contributed on GitHub and GitLab.')).not.toContain('git');
    expect(slugsIn('Managed digital assets for the team.')).not.toContain('git');
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

  it.each([
    ['obeyed all laws and regulations', 'AWS'],
    ['a trusted teammate on every project', 'Rust'],
    ['used MySQL for reporting', 'SQL'],
    ['built a JavaScript parser', 'Java'],
    ['sparked my interest in distributed systems', 'Apache Spark'],
  ])('does not read "%s" as %s', (text, notExpected) => {
    expect(names(text)).not.toContain(notExpected);
  });
});

// The four tracks the catalog was blind to — Design & UX, Security, Game development and
// Embedded & hardware — brought in a second wave of names that are ordinary English words.
// Each one is in AMBIGUOUS_MATCHERS rather than TECHNOLOGY_ALIASES, and this is what that
// buys: the tool matches in a skills list, the word does not match in prose.
describe('everyday words from the four newly covered tracks', () => {
  it.each([
    ['Unity', 'Engines: Unity, Godot', 'The team worked in unity towards one goal.'],
    ['Assembly', 'Languages: C, Assembly', 'Worked on the assembly line during the summer.'],
    ['Helm', 'Kubernetes: Helm, Argo CD', 'She was at the helm of the redesign.'],
    ['Sketch', 'Design: Figma, Sketch', 'I like to sketch ideas before building them.'],
    ['Bun', 'Runtimes: Node.js, Bun', 'We shared a cinnamon bun at the retro.'],
    ['Less', 'Styling: Sass, Less', 'It took me less time than expected.'],
    ['Expo', 'Mobile: React Native, Expo', 'Presented at the student career expo.'],
    ['Capacitor', 'Mobile: Ionic, Capacitor', 'Replaced a blown capacitor on the board.'],
    ['Julia', 'Languages: Python, Julia', 'Mentored by Julia during the placement.'],
  ])('matches %s in a skills list but not in prose', (name, list, prose) => {
    expect(names(list)).toContain(name);
    expect(names(prose)).not.toContain(name);
  });

  it('reads the long forms anywhere, not only next to list punctuation', () => {
    expect(slugsIn('Built a mobile game in Unity3D over one semester.')).toContain('unity');
    expect(slugsIn('Comfortable with x86 assembly language.')).toContain('assembly');
    expect(slugsIn('Packaged the service as Helm charts.')).toContain('helm');
  });

  it('does not read Unreal out of ordinary prose', () => {
    expect(slugsIn('The whole experience felt unreal.')).not.toContain('unreal-engine');
    expect(slugsIn('Engines: Unreal Engine, Godot')).toContain('unreal-engine');
  });

  it('does not read REST API out of "REST endpoints" prose or "the rest of"', () => {
    expect(slugsIn('Documented the rest of the service.')).not.toContain('rest-api');
    expect(slugsIn('Designed a REST API for the booking flow.')).toContain('rest-api');
  });

  it('does not read AWS Lambda out of a lambda expression', () => {
    expect(slugsIn('Refactored the loops into lambda expressions.')).not.toContain('aws-lambda');
    expect(slugsIn('Serverless: AWS Lambda, DynamoDB')).toContain('aws-lambda');
  });
});

// Entries whose text legitimately implies another catalog entry. Asserted rather than left
// implicit, because the catalog header warns that one CV line matching two technologies is
// normally a bug — these are the cases where it is not.
describe('deliberate overlaps', () => {
  it('reads Kali Linux as both Kali Linux and Linux', () => {
    expect(slugsIn('Security: Kali Linux, Nmap')).toEqual(
      expect.arrayContaining(['kali-linux', 'linux'])
    );
  });

  it('reads Keras on its own and no longer as TensorFlow', () => {
    expect(slugsIn('ML: Keras')).toEqual(['keras']);
    expect(slugsIn('ML: TensorFlow')).toEqual(['tensorflow']);
  });

  // "SQL Server" reads as SQL as well because a space follows; "SQLite" does not, because
  // the right boundary rejects the trailing letter. Both are correct, and the asymmetry is
  // easy to get backwards — hence the assertion.
  it('reads SQL out of SQL Server but not out of SQLite', () => {
    expect(slugsIn('Databases: Microsoft SQL Server')).toEqual(
      expect.arrayContaining(['sql', 'sql-server'])
    );
    expect(slugsIn('Databases: SQLite')).toEqual(['sqlite']);
  });
});

// The gap that started this: an intern on one of these tracks could not declare a single
// relevant skill, and the CV scan surfaced nothing for them either.
describe('the four tracks that had no technologies at all', () => {
  it('reads a designer CV', () => {
    expect(
      names('Tools: Figma, Adobe XD, InVision. Wireframing, prototyping, user research.').sort()
    ).toEqual(
      ['Adobe XD', 'Figma', 'InVision', 'Prototyping', 'User Research', 'Wireframing'].sort()
    );
  });

  it('reads a security CV', () => {
    expect(slugsIn('Wireshark, Burp Suite, Nmap, Metasploit; penetration testing')).toEqual(
      expect.arrayContaining([
        'wireshark',
        'burp-suite',
        'nmap',
        'metasploit',
        'penetration-testing',
      ])
    );
  });

  it('reads a game-development CV', () => {
    expect(slugsIn('Engines: Unity, Unreal Engine, Godot. Modelling in Blender.')).toEqual(
      expect.arrayContaining(['unity', 'unreal-engine', 'godot', 'blender'])
    );
  });

  it('reads an embedded CV', () => {
    expect(slugsIn('Arduino, Raspberry Pi, STM32, ESP32, FreeRTOS, VHDL, CAN bus, MATLAB')).toEqual(
      expect.arrayContaining([
        'arduino',
        'raspberry-pi',
        'stm32',
        'esp32',
        'freertos',
        'vhdl',
        'can-bus',
        'matlab',
      ])
    );
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

  it.each([
    ['SCSS', 'Sass'],
    ['ES6', 'JavaScript'],
    ['ES2015', 'JavaScript'],
    ['Type Script', 'TypeScript'],
    ['TailwindCSS', 'Tailwind CSS'],
    ['Dockerfile', 'Docker'],
    ['docker-compose', 'Docker'],
    ['PL/SQL', 'SQL'],
    ['Postgres', 'PostgreSQL'],
    ['Mongoose', 'MongoDB'],
    ['golang', 'Go'],
    ['Languages: Go, Rust', 'Go'],
  ])('matches %s as %s', (text, expected) => {
    expect(names(text)).toContain(expected);
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
