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
//
// Note the version-suffixed spellings CVs actually use ("HTML5", "CSS3", "Python3",
// "Dockerfile"): the right boundary rejects a trailing letter/digit, so the bare alias does
// NOT cover them and each suffixed form needs its own entry. Every slug in
// seeder/defaultTechnologies.js should appear here (or in AMBIGUOUS_MATCHERS) — a slug that
// falls through to fallbackAliases() only matches its literal name, which misses every
// real-world spelling.
const TECHNOLOGY_ALIASES = {
  // —— Languages ——
  // 'java' cannot leak from "javascript": the right boundary rejects the trailing 's'.
  javascript: ['javascript', 'ecmascript', 'es6', 'es2015'],
  typescript: ['typescript', 'type script'],
  python: ['python', 'python3'],
  java: ['java'],
  csharp: ['c#', 'csharp', 'c sharp'],
  php: ['php'],
  ruby: ['ruby'],
  scala: ['scala'],
  elixir: ['elixir', 'phoenix framework'],
  dart: ['dart'],
  // 'sql' cannot leak from "mysql"/"postgresql"/"nosql": the left boundary rejects the
  // preceding letter. "pl/sql" still matches — the slash normalizes to a space. It does
  // match the "SQL" of "SQL Server" (a space follows) but not of "SQLite" (a letter does).
  sql: ['sql'],
  'objective-c': ['objective c', 'objc'],
  perl: ['perl'],
  lua: ['lua'],
  haskell: ['haskell'],
  clojure: ['clojure', 'clojurescript'],
  erlang: ['erlang'],
  fsharp: ['f#', 'fsharp', 'f sharp'],
  groovy: ['groovy'],
  solidity: ['solidity'],
  matlab: ['matlab', 'simulink'],
  bash: ['bash', 'shell scripting', 'shell script'],
  powershell: ['powershell', 'power shell'],
  'visual-basic': ['visual basic', 'vb.net', 'vba'],

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
  // Bare "remix" is safe: the right boundary rejects a following letter, so "remixed" and
  // "remixing" do not match.
  remix: ['remix', 'remix.js', 'remix run'],
  gatsby: ['gatsby', 'gatsby.js', 'gatsbyjs'],
  qwik: ['qwik'],
  preact: ['preact'],
  // Bare "ember" is a common noun and a given name; the suffixed spellings carry the signal.
  'ember-js': ['ember.js', 'emberjs', 'ember js'],
  'alpine-js': ['alpine.js', 'alpinejs', 'alpine js'],
  'web-components': ['web components'],
  webassembly: ['webassembly', 'web assembly', 'wasm'],
  'progressive-web-apps': ['progressive web apps', 'progressive web app', 'pwa'],
  electron: ['electron', 'electron.js'],
  zustand: ['zustand'],
  'tanstack-query': ['tanstack query', 'tanstack', 'react query'],
  'react-router': ['react router'],
  rxjs: ['rxjs', 'rx.js'],
  'styled-components': ['styled components'],
  'chakra-ui': ['chakra ui', 'chakra'],
  'ant-design': ['ant design', 'antd'],
  'shadcn-ui': ['shadcn ui', 'shadcn'],
  'radix-ui': ['radix ui', 'radix'],
  // Bare "d3" is omitted — it reads as a part number or a grade as often as the library.
  'd3-js': ['d3.js', 'd3js', 'd3 js'],
  'chart-js': ['chart.js', 'chartjs'],
  // "Framer Motion" also matches `framer` below. That overlap is deliberate and matches the
  // established behaviour of "GitHub Actions" also matching GitHub.
  'framer-motion': ['framer motion'],

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
  // Bare "ruby" belongs to the `ruby` language above, not to Rails.
  'ruby-on-rails': ['ruby on rails', 'rails', 'ror'],
  graphql: ['graphql'],
  fastify: ['fastify'],
  koa: ['koa', 'koa.js', 'koajs'],
  deno: ['deno'],
  trpc: ['trpc', 't rpc'],
  quarkus: ['quarkus'],
  micronaut: ['micronaut'],
  blazor: ['blazor'],
  hibernate: ['hibernate', 'jpa'],
  'entity-framework': ['entity framework', 'ef core'],
  prisma: ['prisma'],
  sequelize: ['sequelize'],
  typeorm: ['typeorm'],
  strapi: ['strapi'],
  wordpress: ['wordpress'],
  drupal: ['drupal'],
  shopify: ['shopify'],
  // Bare "rest" is omitted on purpose — "rest of the team", "REST endpoints" is prose.
  'rest-api': ['rest api', 'rest apis', 'restful', 'restful api', 'restful apis'],
  grpc: ['grpc'],
  websockets: ['websockets', 'websocket', 'web sockets'],
  'socket-io': ['socket.io', 'socketio', 'socket io'],
  rabbitmq: ['rabbitmq', 'rabbit mq'],
  'apache-tomcat': ['apache tomcat', 'tomcat'],
  'apache-http-server': ['apache http server', 'apache httpd', 'httpd'],
  swagger: ['swagger', 'openapi', 'open api'],

  // —— Databases ——
  postgresql: ['postgresql', 'postgres', 'postgre sql', 'psql'],
  mysql: ['mysql', 'my sql'],
  mongodb: ['mongodb', 'mongo db', 'mongo', 'mongoose'],
  redis: ['redis'],
  'sql-server': ['sql server', 'mssql', 't sql', 'tsql'],
  'oracle-database': ['oracle database', 'oracle db', 'pl sql', 'plsql'],
  elasticsearch: ['elasticsearch', 'elastic search', 'elk stack'],
  sqlite: ['sqlite', 'sqlite3'],
  mariadb: ['mariadb', 'maria db'],
  'apache-cassandra': ['apache cassandra', 'cassandra'],
  neo4j: ['neo4j'],
  dynamodb: ['dynamodb', 'amazon dynamodb', 'dynamo db'],
  firebase: ['firebase', 'firestore'],
  supabase: ['supabase'],
  clickhouse: ['clickhouse', 'click house'],
  influxdb: ['influxdb', 'influx db'],
  couchdb: ['couchdb', 'couch db'],
  snowflake: ['snowflake'],
  bigquery: ['bigquery', 'google bigquery', 'big query'],
  redshift: ['redshift', 'amazon redshift'],

  // —— Mobile ——
  kotlin: ['kotlin'],
  swift: ['swift', 'swiftui', 'swift ui'],
  android: ['android', 'android studio', 'jetpack compose'],
  ios: ['ios', 'xcode'],
  'react-native': ['react native', 'reactnative'],
  flutter: ['flutter'],
  ionic: ['ionic'],
  xamarin: ['xamarin', '.net maui'],
  'kotlin-multiplatform': ['kotlin multiplatform', 'kmp', 'kmm'],

  // —— Data & analytics ——
  pandas: ['pandas'],
  numpy: ['numpy'],
  // Bare "spark" is omitted on purpose — "sparked my interest in…" is common CV prose.
  'apache-spark': ['apache spark', 'pyspark', 'spark sql', 'spark streaming'],
  'apache-airflow': ['airflow', 'apache airflow'],
  'apache-kafka': ['kafka', 'apache kafka'],
  'power-bi': ['power bi', 'powerbi'],
  tableau: ['tableau'],
  'apache-hadoop': ['apache hadoop', 'hadoop'],
  'apache-flink': ['apache flink', 'flink'],
  databricks: ['databricks'],
  dbt: ['dbt'],
  looker: ['looker', 'lookml'],
  'qlik-sense': ['qlik sense', 'qlik', 'qlikview'],
  matplotlib: ['matplotlib'],
  scipy: ['scipy'],

  // —— ML & AI ——
  // "keras" used to be an alias of tensorflow. It is its own catalog entry now — leaving it
  // on both would auto-declare one CV line as two technologies.
  tensorflow: ['tensorflow', 'tensor flow'],
  pytorch: ['pytorch', 'py torch'],
  'scikit-learn': ['scikit learn', 'scikit', 'sklearn'],
  keras: ['keras'],
  opencv: ['opencv', 'open cv'],
  'hugging-face': ['hugging face', 'huggingface'],
  langchain: ['langchain', 'lang chain'],
  'openai-api': ['openai api', 'openai', 'open ai'],
  mlflow: ['mlflow', 'ml flow'],
  xgboost: ['xgboost', 'xg boost'],
  'large-language-models': ['large language models', 'large language model', 'llm', 'llms'],
  rag: ['retrieval augmented generation', 'rag'],
  'prompt-engineering': ['prompt engineering'],
  'computer-vision': ['computer vision'],
  nlp: ['natural language processing', 'nlp'],
  'stable-diffusion': ['stable diffusion'],
  ollama: ['ollama'],
  'vector-databases': [
    'vector databases',
    'vector database',
    'pinecone',
    'pgvector',
    'weaviate',
    'qdrant',
  ],

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
  vitest: ['vitest'],
  mocha: ['mocha', 'mocha.js', 'mochajs'],
  'testing-library': ['testing library', 'react testing library'],
  testng: ['testng'],
  cucumber: ['cucumber', 'gherkin'],
  'rest-assured': ['rest assured', 'restassured'],
  appium: ['appium'],
  'robot-framework': ['robot framework'],
  jmeter: ['jmeter', 'apache jmeter'],
  k6: ['k6'],
  insomnia: ['insomnia'],
  sonarqube: ['sonarqube', 'sonar qube', 'sonarcloud'],
  'performance-testing': ['performance testing', 'load testing', 'stress testing'],
  'api-testing': ['api testing'],

  // —— DevOps & cloud ——
  docker: ['docker', 'dockerfile', 'docker compose'],
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
  'argo-cd': ['argo cd', 'argocd'],
  prometheus: ['prometheus'],
  grafana: ['grafana'],
  kibana: ['kibana'],
  logstash: ['logstash'],
  datadog: ['datadog', 'data dog'],
  splunk: ['splunk'],
  sentry: ['sentry'],
  'new-relic': ['new relic', 'newrelic'],
  circleci: ['circleci', 'circle ci'],
  'azure-devops': ['azure devops', 'azure pipelines'],
  'bitbucket-pipelines': ['bitbucket pipelines'],
  vagrant: ['vagrant'],
  pulumi: ['pulumi'],
  'serverless-framework': ['serverless framework', 'serverless'],
  // Bare "lambda" is omitted — it is a language construct ("lambda expressions") far more
  // often than it is the AWS product.
  'aws-lambda': ['aws lambda', 'lambda functions'],
  cloudflare: ['cloudflare', 'cloud flare'],
  vercel: ['vercel'],
  netlify: ['netlify'],
  heroku: ['heroku'],
  digitalocean: ['digitalocean', 'digital ocean'],

  // —— Design & UX ——
  figma: ['figma'],
  // Bare "xd" is omitted — two letters, and it reads as an emoticon.
  'adobe-xd': ['adobe xd'],
  'adobe-photoshop': ['adobe photoshop', 'photoshop'],
  'adobe-illustrator': ['adobe illustrator', 'illustrator'],
  'adobe-after-effects': ['adobe after effects', 'after effects'],
  invision: ['invision'],
  framer: ['framer'],
  canva: ['canva'],
  miro: ['miro'],
  'axure-rp': ['axure rp', 'axure'],
  wireframing: ['wireframing', 'wireframes', 'wireframe'],
  prototyping: ['prototyping', 'prototypes'],
  'user-research': ['user research'],
  'usability-testing': ['usability testing'],
  'design-systems': ['design systems', 'design system'],
  // Bare "accessibility" is omitted so it does not swallow every mention of the word; the
  // explicit spellings are what an intern with the skill actually writes.
  'web-accessibility': ['web accessibility', 'wcag', 'a11y'],

  // —— Security ——
  wireshark: ['wireshark'],
  'burp-suite': ['burp suite', 'burpsuite', 'burp'],
  // "Kali Linux" also matches `linux`. Deliberate — Kali is a Linux distribution, the same
  // way "Ubuntu" is already a linux alias.
  'kali-linux': ['kali linux', 'kali'],
  nmap: ['nmap'],
  metasploit: ['metasploit', 'meterpreter'],
  'owasp-zap': ['owasp zap', 'owasp', 'zap proxy'],
  ghidra: ['ghidra'],
  'hashicorp-vault': ['hashicorp vault'],
  keycloak: ['keycloak'],
  oauth: ['oauth 2.0', 'oauth2', 'oauth', 'openid connect'],
  'penetration-testing': ['penetration testing', 'pentesting', 'pen testing', 'pentester'],
  'network-security': ['network security'],
  cryptography: ['cryptography'],
  siem: ['siem'],
  'incident-response': ['incident response'],
  'threat-modeling': ['threat modeling', 'threat modelling'],
  'malware-analysis': ['malware analysis', 'reverse engineering'],
  'vulnerability-assessment': ['vulnerability assessment', 'vulnerability scanning'],

  // —— Game development ——
  // Bare "unreal" is omitted — it is an ordinary adjective.
  'unreal-engine': ['unreal engine', 'unreal editor', 'ue4', 'ue5'],
  godot: ['godot'],
  blender: ['blender'],
  'three-js': ['three.js', 'threejs', 'three js'],
  phaser: ['phaser'],
  pixijs: ['pixijs', 'pixi.js'],

  // —— Embedded & hardware ——
  arduino: ['arduino'],
  'raspberry-pi': ['raspberry pi'],
  stm32: ['stm32'],
  esp32: ['esp32', 'esp8266'],
  freertos: ['freertos', 'free rtos'],
  'zephyr-rtos': ['zephyr rtos', 'zephyr'],
  vhdl: ['vhdl'],
  verilog: ['verilog', 'systemverilog'],
  'can-bus': ['can bus', 'canbus'],
  'plc-programming': ['plc programming', 'plc', 'ladder logic'],
  'embedded-c': ['embedded c'],
  mqtt: ['mqtt'],

  // —— Tooling ——
  // 'git' cannot leak from "github"/"gitlab"/"gitignore" (right boundary rejects the
  // following letter) or from "digit" (left boundary rejects the preceding one).
  git: ['git'],
  github: ['github'],
  gitlab: ['gitlab'],
  bitbucket: ['bitbucket'],
  jira: ['jira'],
  confluence: ['confluence'],
  trello: ['trello'],
  vite: ['vite', 'vitejs', 'vite.js'],
  webpack: ['webpack', 'web pack'],
  babel: ['babel', 'babel.js'],
  eslint: ['eslint'],
  storybook: ['storybook'],
  maven: ['maven', 'apache maven'],
  gradle: ['gradle'],
  nx: ['nx'],
  turborepo: ['turborepo', 'turbo repo'],

  // —— Practices ——
  microservices: ['microservices', 'microservice', 'micro services'],
  'ci-cd': ['ci cd', 'continuous integration', 'continuous delivery', 'continuous deployment'],
  tdd: ['test driven development', 'tdd'],
  scrum: ['scrum'],
  kanban: ['kanban'],

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
  // "Unity" — "in unity with", "unity of purpose".
  unity: {
    lower: ['unity3d', 'unity 3d', 'unity engine'].map(buildAliasRegex),
    cased: buildListContextRegexes('Unity'),
  },
  // "Assembly" — "assembly line", "general assembly".
  assembly: {
    lower: ['assembly language', 'x86 assembly', 'arm assembly'].map(buildAliasRegex),
    cased: buildListContextRegexes('Assembly'),
  },
  // "Julia" — a given name, and CVs carry names.
  julia: {
    lower: ['julia lang', 'julia programming'].map(buildAliasRegex),
    cased: buildListContextRegexes('Julia'),
  },
  // "Helm" — "at the helm of".
  helm: {
    lower: ['helm charts', 'helm chart'].map(buildAliasRegex),
    cased: buildListContextRegexes('Helm'),
  },
  // "Sketch" — "sketch designs", "sketch out". The right boundary already rejects
  // "sketching"/"sketches", but the bare verb stays too common for a plain alias.
  sketch: {
    lower: ['sketch app'].map(buildAliasRegex),
    cased: buildListContextRegexes('Sketch'),
  },
  // "Bun" — an everyday noun.
  bun: {
    lower: ['bun.js', 'bunjs', 'bun runtime'].map(buildAliasRegex),
    cased: buildListContextRegexes('Bun'),
  },
  // "Less" — one of the commonest words in English, so capitalization carries real signal
  // here and the cased matcher is deliberately NOT case-insensitive.
  less: {
    lower: ['less css', 'lesscss'].map(buildAliasRegex),
    cased: buildListContextRegexes('Less'),
  },
  // "Expo" — "career expo", "tech expo".
  expo: {
    lower: ['expo go', 'expo cli', 'react native expo'].map(buildAliasRegex),
    cased: buildListContextRegexes('Expo'),
  },
  // "Capacitor" — an electronic component, and the embedded technologies above mean those
  // CVs now reach this matcher.
  capacitor: {
    lower: ['ionic capacitor', 'capacitor.js', 'capacitorjs'].map(buildAliasRegex),
    cased: buildListContextRegexes('Capacitor'),
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
