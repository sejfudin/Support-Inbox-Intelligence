// Recognizes which technologies from the canonical Technology catalog are mentioned in
// a block of free text (a parsed CV). Matching is deterministic keyword/alias matching
// scoped to the catalog — the output is always a subset of the technologies passed in,
// so a CV can never introduce a technology that does not already exist in the app.
//
// How much of a real CV gets recognized is therefore a function of two things: how broad
// the catalog is (seeder/defaultTechnologies.js) and how good the aliases below are. When
// you add a technology to the catalog, add its aliases here in the same change.
//
// Keyed by Technology `slug` (the same slugs seeded in seeder/defaultTechnologies.js).
// Technologies not listed here (e.g. an admin-added custom one) fall back to matching
// their name/slug directly — see fallbackAliases().

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Assorted unicode spaces (nbsp, ogham, en/em spaces, zero-width, ideographic, BOM) and
// dashes (hyphen, non-breaking hyphen, figure/en/em dash, horizontal bar, underscore, plus
// the plain ASCII hyphen).
//
// Written as \u escapes on purpose: as literal characters these classes are invisible in a
// diff and trivially mangled by an editor or a copy-paste — and flattening one of the space
// characters to an ASCII space turns the \u2000-\u200b range into \u0020-\u200b, which swallows
// every ASCII letter and silently blanks all CV text instead of failing loudly.
const UNICODE_SPACES = /[\u00a0\u1680\u2000-\u200b\u202f\u205f\u3000\ufeff]/g;
const DASHES = /[_\u2010-\u2015-]+/g;

// Lowercased, delimiter-normalized text used for the alias regexes. Hyphens, underscores
// and slashes collapse to spaces so "react-native" / "react/native" read like "react native";
// dots/plus/hash are preserved because they are part of tech names (node.js, c++, c#).
const normalizeText = (raw) =>
  String(raw || '')
    .toLowerCase()
    .replace(UNICODE_SPACES, ' ')
    .replace(DASHES, ' ')
    .replace(/\//g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Case-preserving variant that keeps list delimiters (, ; | ( ) : /). Used only for the
// ambiguous short names ("Go", "C", "R", "Express"), which lean on capitalization and/or
// list punctuation rather than on the term alone.
const normalizeCased = (raw) =>
  String(raw || '')
    .replace(UNICODE_SPACES, ' ')
    .replace(DASHES, ' ')
    .replace(/[ \t\r\n]+/g, ' ')
    .trim();

// alias -> RegExp. Left boundary rejects a preceding letter/digit so "rust" ≠ "trust".
// Right boundary rejects a following letter (and a digit too, unless the alias ends in a
// symbol like c++ / c# so "c++17" still matches).
//
// Note the digit rejection cuts both ways: "html" does NOT match "HTML5" and "python" does
// not match "Python3", so versioned spellings need their own alias entry.
const buildAliasRegex = (alias) => {
  const escaped = escapeRegExp(alias);
  const right = /[a-z0-9]$/.test(alias) ? '(?![a-z0-9])' : '(?![a-z])';
  return new RegExp(`(?<![a-z0-9])${escaped}${right}`);
};

// Extra terms beyond a tech's own name that should count as a mention. Deliberately
// conservative: bare, common-word forms ("next", "node", "spring", "nest", "solid") are
// omitted to avoid false positives — the multi-word/suffixed forms below carry the signal.
// Genuinely ambiguous names live in AMBIGUOUS_MATCHERS instead.
const TECHNOLOGY_ALIASES = {
  // —— Languages ——
  javascript: ['javascript', 'ecmascript', 'es6'],
  typescript: ['typescript'],
  python: ['python', 'python3'],
  java: ['java'],
  csharp: ['c#', 'csharp', 'c sharp'],
  php: ['php'],
  ruby: ['ruby'],
  scala: ['scala'],
  elixir: ['elixir', 'phoenix framework'],
  dart: ['dart'],
  sql: ['sql'],

  // —— Frontend ——
  react: ['react', 'react.js', 'reactjs'],
  angular: ['angular', 'angularjs', 'angular.js'],
  'vue-js': ['vue', 'vue.js', 'vuejs'],
  'next-js': ['next.js', 'nextjs', 'next js'],
  'nuxt-js': ['nuxt', 'nuxt.js', 'nuxtjs'],
  svelte: ['svelte', 'sveltekit', 'svelte kit'],
  astro: ['astro', 'astro.js', 'astrojs'],
  solidjs: ['solidjs', 'solid.js', 'solid js'],
  redux: ['redux', 'redux toolkit'],
  jquery: ['jquery'],
  html: ['html', 'html5'],
  css: ['css', 'css3'],
  sass: ['sass', 'scss'],
  'tailwind-css': ['tailwind', 'tailwindcss', 'tailwind css'],
  bootstrap: ['bootstrap'],
  'material-ui': ['material ui', 'materialui', 'mui'],

  // —— Backend ——
  'node-js': ['node.js', 'nodejs', 'node js'],
  nestjs: ['nestjs', 'nest.js', 'nest js'],
  'spring-boot': ['spring boot', 'springboot', 'spring framework', 'spring mvc'],
  dotnet: ['.net', 'dotnet', 'dot net', 'asp.net', 'asp.net core', '.net core'],
  django: ['django'],
  fastapi: ['fastapi', 'fast api'],
  flask: ['flask'],
  laravel: ['laravel'],
  symfony: ['symfony'],
  'ruby-on-rails': ['ruby on rails', 'rails', 'ror'],
  graphql: ['graphql'],

  // —— Databases ——
  postgresql: ['postgresql', 'postgres', 'postgre sql', 'psql'],
  mysql: ['mysql', 'my sql'],
  mongodb: ['mongodb', 'mongo db', 'mongo', 'mongoose'],
  redis: ['redis'],
  'sql-server': ['sql server', 'mssql', 't sql', 'tsql'],
  'oracle-database': ['oracle database', 'oracle db', 'pl sql', 'plsql'],
  elasticsearch: ['elasticsearch', 'elastic search', 'elk stack'],

  // —— Mobile ——
  kotlin: ['kotlin'],
  swift: ['swift', 'swiftui', 'swift ui'],
  android: ['android', 'android studio', 'jetpack compose'],
  ios: ['ios', 'xcode'],
  'react-native': ['react native', 'reactnative'],
  flutter: ['flutter'],
  ionic: ['ionic'],
  xamarin: ['xamarin', '.net maui'],

  // —— Data & analytics ——
  'data-engineering': ['data engineering', 'data engineer'],
  'data-science': ['data science', 'data scientist'],
  pandas: ['pandas'],
  numpy: ['numpy'],
  // Bare "spark" is omitted on purpose — "sparked my interest in…" is common CV prose.
  'apache-spark': ['apache spark', 'pyspark', 'spark sql', 'spark streaming'],
  'apache-airflow': ['airflow', 'apache airflow'],
  'apache-kafka': ['kafka', 'apache kafka'],
  'power-bi': ['power bi', 'powerbi'],
  tableau: ['tableau'],

  // —— ML ——
  'machine-learning': ['machine learning', 'ml', 'deep learning'],
  tensorflow: ['tensorflow', 'tensor flow', 'keras'],
  pytorch: ['pytorch', 'py torch'],
  'scikit-learn': ['scikit learn', 'scikit', 'sklearn'],

  // —— QA ——
  'manual-qa': ['manual qa', 'manual testing', 'manual tester'],
  'test-automation': [
    'test automation',
    'automation testing',
    'automated testing',
    'qa automation',
    'sdet',
  ],
  selenium: ['selenium', 'selenium webdriver'],
  cypress: ['cypress'],
  playwright: ['playwright'],
  jest: ['jest'],
  junit: ['junit', 'junit5'],
  postman: ['postman'],

  // —— DevOps & cloud ——
  devops: ['devops', 'dev ops'],
  docker: ['docker', 'dockerfile'],
  kubernetes: ['kubernetes', 'k8s', 'kubectl'],
  aws: ['aws', 'amazon web services', 'amazon s3', 'ec2'],
  azure: ['azure'],
  'google-cloud': ['google cloud', 'gcp'],
  terraform: ['terraform'],
  ansible: ['ansible'],
  jenkins: ['jenkins'],
  'github-actions': ['github actions', 'gh actions'],
  'gitlab-ci': ['gitlab ci', 'gitlab pipelines', 'gitlab runner'],
  linux: ['linux', 'ubuntu', 'debian'],
  nginx: ['nginx'],

  // —— Specialized engineering ——
  cpp: ['c++', 'cpp'],
  rust: ['rust'],
};

// Precompile the known aliases once.
const COMPILED_ALIASES = Object.fromEntries(
  Object.entries(TECHNOLOGY_ALIASES).map(([slug, aliases]) => [slug, aliases.map(buildAliasRegex)])
);

// A few technology names are also everyday English words ("Go", "C", "R", "Express"), so bare
// matching would be far too noisy. Those are accepted only when the term sits next to list
// punctuation — the shape of a skills list ("Languages: Go, Rust", "Node.js, Express, MongoDB"),
// not prose — or via an unambiguous long form ("golang"), which is handled separately below.
//
// `term` is a regex fragment, matched against the case-PRESERVING text so capitalization can
// carry signal; pass flags: 'i' for names where it can't. `reject` adds characters that must
// not follow the term, so "C++"/"C#" never count as C and "R&D" never counts as R.
const buildListContextRegexes = (term, { flags = '', reject = '' } = {}) => [
  new RegExp(`[,;|/(:]\\s*${term}(?![A-Za-z0-9${reject}])`, flags),
  new RegExp(`(?<![A-Za-z0-9])${term}\\s*(?=[,;|/)])`, flags),
];

// slug -> { lower: RegExp[] (unambiguous long forms), cased: RegExp[] (list-shape forms) }.
// A tech listed here ignores TECHNOLOGY_ALIASES entirely — every form it accepts is here.
const AMBIGUOUS_MATCHERS = {
  // "Go" — "ready to go", "on the go".
  go: {
    lower: [/(?<![a-z0-9])golang(?![a-z0-9])/, /(?<![a-z0-9])go\s+lang(?![a-z0-9])/],
    cased: buildListContextRegexes('(?:Go|GO)'),
  },
  // "C" — one letter, and it must never swallow the "C" of C++ / C#.
  c: {
    lower: [],
    cased: buildListContextRegexes('C', { reject: '+#' }),
  },
  // "R" — one letter, and "R&D" is common on CVs.
  r: {
    lower: [/(?<![a-z0-9])r\s+programming(?![a-z0-9])/, /(?<![a-z0-9])r\s+lang(?![a-z0-9])/],
    cased: buildListContextRegexes('R', { reject: '&' }),
  },
  // "Express" — capitalization carries no signal (it starts sentences too), so the list shape
  // is the only cue for the bare form; the explicit spellings match anywhere.
  'express-js': {
    lower: [
      /(?<![a-z0-9])express\.?js(?![a-z0-9])/,
      /(?<![a-z0-9])express\s+js(?![a-z0-9])/,
      /(?<![a-z0-9])express\s+framework(?![a-z0-9])/,
    ],
    cased: buildListContextRegexes('Express', { flags: 'i' }),
  },
};

// For technologies with no curated entry (e.g. admin-added), match the name and slug directly.
const fallbackAliases = (tech) => {
  const aliases = new Set();
  const name = normalizeText(tech.name || '');
  const slug = normalizeText(tech.slug || '');
  if (name.length >= 2) aliases.add(name);
  if (slug.length >= 2 && slug !== name) aliases.add(slug);
  return [...aliases];
};

// Given raw CV text and the technology catalog, return the subset of technologies mentioned.
// Preserves the input order and objects (so callers keep _id/name/slug). Inactive technologies
// are ignored.
const matchTechnologiesInText = (rawText, technologies = []) => {
  const lowerText = normalizeText(rawText);
  if (!lowerText) return [];
  const casedText = normalizeCased(rawText);

  const matched = [];
  for (const tech of technologies) {
    if (!tech || tech.isActive === false) continue;
    const slug = String(tech.slug || '').toLowerCase();

    const ambiguous = AMBIGUOUS_MATCHERS[slug];
    if (ambiguous) {
      const hit =
        ambiguous.lower.some((rx) => rx.test(lowerText)) ||
        ambiguous.cased.some((rx) => rx.test(casedText));
      if (hit) matched.push(tech);
      continue;
    }

    const regexes = COMPILED_ALIASES[slug] || fallbackAliases(tech).map(buildAliasRegex);
    if (regexes.some((rx) => rx.test(lowerText))) matched.push(tech);
  }

  return matched;
};

module.exports = {
  matchTechnologiesInText,
  normalizeText,
  TECHNOLOGY_ALIASES,
  AMBIGUOUS_MATCHERS,
};
