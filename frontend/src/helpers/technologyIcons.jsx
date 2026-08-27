import { Code2 } from 'lucide-react';
import {
  AWS,
  AdobeXD,
  Android,
  Angular,
  Anthropic,
  Ansible,
  Apache,
  AppleDark,
  AppleLight,
  Astro,
  Axure,
  Azure,
  Babel,
  Bash,
  Bitbucket,
  Bootstrap5,
  BunJs,
  C,
  CPlusPlus,
  CSS3,
  CSharp,
  Canva,
  CassandraDB,
  ChatGPT,
  ChakraUI,
  CircleCI,
  ClickHouse,
  Clojure,
  ClaudeAI,
  Cloudflare,
  Cypress,
  Dart,
  Datadog,
  Deno,
  DigitalOcean,
  Django,
  Docker,
  ESLint,
  Elastic,
  Electron,
  Elixir,
  Ember,
  Erlang,
  ExpressJsDark,
  ExpressJsLight,
  FastAPI,
  Figma,
  Firebase,
  FlaskDark,
  FlaskLight,
  Flutter,
  FramerDark,
  FramerLight,
  Gatsby,
  Git,
  GitHubDark,
  GitHubLight,
  GitHubCopilot,
  GitLab,
  Go,
  Google,
  GoogleCloud,
  Grafana,
  GraphQL,
  HTML5,
  Haskell,
  Heroku,
  HuggingFace,
  InVision,
  Insomnia,
  Ionic,
  JQuery,
  Java,
  JavaScript,
  Jenkins,
  Jest,
  Jira,
  K6,
  Kafka,
  Kibana,
  Kotlin,
  Kubernetes,
  Laravel,
  Less,
  Linux,
  Lua,
  MariaDB,
  MaterialUI,
  MicrosoftSQLServer,
  Miro,
  MochaJS,
  MongoDB,
  MySQL,
  NestJS,
  Netlify,
  NextJs,
  NodeJs,
  NumPy,
  NuxtJs,
  Nx,
  OpenAI,
  Oracle,
  PHP,
  PWA,
  Photoshop,
  PixiJS,
  Playwright,
  PostgreSQL,
  Postman,
  PowerShell,
  Preact,
  Prisma,
  PulumiDark,
  PulumiLight,
  PyTorch,
  Python,
  Qwik,
  R,
  RadixUI,
  Rails,
  React as ReactIcon,
  ReactQuery,
  ReactRouter,
  Redis,
  Redux,
  RemixDark,
  RemixLight,
  Ruby,
  RustDark,
  RustLight,
  Sass,
  Scala,
  Serverless,
  ShadcnUI,
  Sketch,
  SolidJS,
  Solidity,
  Spring,
  Storybook,
  Supabase,
  SvelteJS,
  Swagger,
  Swift,
  SymfonyDark,
  SymfonyLight,
  TRPC,
  TailwindCSS,
  Tensorflow,
  Terraform,
  ThreeJsDark,
  ThreeJsLight,
  TypeScript,
  Vagrant,
  VercelDark,
  VercelLight,
  VisualBasic,
  ViteJS,
  Vitest,
  VueJs,
  WebAssembly,
  Webpack,
  WordPress,
  Xamarin,
} from 'developer-icons';
import { cn } from '@/lib/utils';

// Maps a Technology (by its stable slug) to a brand logo from `developer-icons`.
//
// A value is either a single component, or a { onLight, onDark } pair for logos that are
// solid black or solid white — `developer-icons` ships those as two variants, and picking
// one would make the logo invisible in the other theme.
//
// Technologies that are conceptual rather than a single product (Manual QA, SQL, Wireframing,
// Penetration Testing, Microservices, …) intentionally have no entry, and neither do the many
// products the icon set does not cover (Selenium, Tableau, Power BI, Nginx, pandas,
// scikit-learn, Spark, Airflow, JUnit, SQLite, Unity, Unreal Engine, Godot, Blender, Wireshark,
// Burp Suite, Arduino, Raspberry Pi, MATLAB, …). Both fall back to a neutral code glyph via
// TechnologyIcon below.
//
// The AI skills group at the bottom is the sparsest of all — see its own note there.
//
// The set covers the web and cloud stacks densely and the four tracks added alongside the
// Design & UX / Security / Game development / Embedded groups only patchily — design tools have
// logos here, security and embedded tools almost entirely do not. That is expected, not a gap
// to chase: the fallback glyph is the designed outcome for anything without a brand mark.
const ICON_BY_SLUG = {
  // —— Languages ——
  javascript: JavaScript,
  typescript: TypeScript,
  python: Python,
  java: Java,
  csharp: CSharp,
  c: C,
  php: PHP,
  ruby: Ruby,
  scala: Scala,
  elixir: Elixir,
  dart: Dart,
  r: R,
  haskell: Haskell,
  clojure: Clojure,
  erlang: Erlang,
  lua: Lua,
  solidity: Solidity,
  bash: Bash,
  powershell: PowerShell,
  'visual-basic': VisualBasic,

  // —— Frontend ——
  react: ReactIcon,
  angular: Angular,
  'vue-js': VueJs,
  'next-js': NextJs,
  'nuxt-js': NuxtJs,
  svelte: SvelteJS,
  astro: Astro,
  solidjs: SolidJS,
  redux: Redux,
  jquery: JQuery,
  html: HTML5,
  css: CSS3,
  sass: Sass,
  'tailwind-css': TailwindCSS,
  bootstrap: Bootstrap5,
  'material-ui': MaterialUI,
  remix: { onLight: RemixDark, onDark: RemixLight },
  gatsby: Gatsby,
  qwik: Qwik,
  preact: Preact,
  'ember-js': Ember,
  webassembly: WebAssembly,
  'progressive-web-apps': PWA,
  electron: Electron,
  'tanstack-query': ReactQuery,
  'react-router': ReactRouter,
  'chakra-ui': ChakraUI,
  'shadcn-ui': ShadcnUI,
  'radix-ui': RadixUI,
  less: Less,

  // —— Backend ——
  'node-js': NodeJs,
  'express-js': { onLight: ExpressJsDark, onDark: ExpressJsLight },
  nestjs: NestJS,
  'spring-boot': Spring,
  dotnet: CSharp,
  django: Django,
  fastapi: FastAPI,
  flask: { onLight: FlaskDark, onDark: FlaskLight },
  go: Go,
  laravel: Laravel,
  symfony: { onLight: SymfonyDark, onDark: SymfonyLight },
  'ruby-on-rails': Rails,
  graphql: GraphQL,
  deno: Deno,
  bun: BunJs,
  trpc: TRPC,
  prisma: Prisma,
  wordpress: WordPress,
  'apache-http-server': Apache,
  swagger: Swagger,

  // —— Databases ——
  postgresql: PostgreSQL,
  mysql: MySQL,
  mongodb: MongoDB,
  redis: Redis,
  'sql-server': MicrosoftSQLServer,
  'oracle-database': Oracle,
  elasticsearch: Elastic,
  mariadb: MariaDB,
  'apache-cassandra': CassandraDB,
  firebase: Firebase,
  supabase: Supabase,
  clickhouse: ClickHouse,

  // —— Mobile ——
  kotlin: Kotlin,
  swift: Swift,
  android: Android,
  ios: { onLight: AppleDark, onDark: AppleLight },
  'react-native': ReactIcon,
  flutter: Flutter,
  ionic: Ionic,
  xamarin: Xamarin,

  // —— Data, analytics & ML ——
  numpy: NumPy,
  'apache-kafka': Kafka,
  tensorflow: Tensorflow,
  pytorch: PyTorch,
  'hugging-face': HuggingFace,
  'openai-api': OpenAI,

  // —— QA ——
  cypress: Cypress,
  playwright: Playwright,
  jest: Jest,
  postman: Postman,
  vitest: Vitest,
  mocha: MochaJS,
  k6: K6,
  insomnia: Insomnia,

  // —— DevOps & cloud ——
  docker: Docker,
  kubernetes: Kubernetes,
  aws: AWS,
  azure: Azure,
  'google-cloud': GoogleCloud,
  terraform: Terraform,
  ansible: Ansible,
  jenkins: Jenkins,
  'github-actions': { onLight: GitHubDark, onDark: GitHubLight },
  'gitlab-ci': GitLab,
  linux: Linux,
  grafana: Grafana,
  kibana: Kibana,
  datadog: Datadog,
  circleci: CircleCI,
  vagrant: Vagrant,
  pulumi: { onLight: PulumiDark, onDark: PulumiLight },
  'serverless-framework': Serverless,
  cloudflare: Cloudflare,
  vercel: { onLight: VercelDark, onDark: VercelLight },
  netlify: Netlify,
  heroku: Heroku,
  digitalocean: DigitalOcean,

  // —— Design & UX ——
  figma: Figma,
  'adobe-xd': AdobeXD,
  sketch: Sketch,
  'adobe-photoshop': Photoshop,
  invision: InVision,
  framer: { onLight: FramerDark, onDark: FramerLight },
  canva: Canva,
  miro: Miro,
  'axure-rp': Axure,

  // —— Game development ——
  'three-js': { onLight: ThreeJsDark, onDark: ThreeJsLight },
  pixijs: PixiJS,

  // —— Tooling ——
  git: Git,
  github: { onLight: GitHubDark, onDark: GitHubLight },
  gitlab: GitLab,
  bitbucket: Bitbucket,
  jira: Jira,
  vite: ViteJS,
  webpack: Webpack,
  babel: Babel,
  eslint: ESLint,
  storybook: Storybook,
  nx: Nx,

  // —— AI skills ——
  // Sparser than the groups above by nature: the icon set covers the big vendors and almost
  // none of the young agent tools (Cursor, Windsurf, Cline, Aider, Devin, Lovable, Bolt.new,
  // Perplexity, Replit Agent, …), and the practice entries — MCP, Agent Skills, prompt
  // engineering, evals — have no single mark to carry in the first place. All of them fall
  // back to the neutral glyph, which is the designed outcome.
  //
  // Where a vendor ships several entries they share the vendor's mark: Codex and the Agents
  // SDK are both OpenAI, the Gemini API and its CLI are both Google. Two rows with one logo
  // is correct here — the name beside it is what distinguishes them.
  'claude-code': ClaudeAI,
  'anthropic-claude-api': Anthropic,
  'claude-agent-sdk': Anthropic,
  'github-copilot': GitHubCopilot,
  'github-copilot-agent-mode': GitHubCopilot,
  chatgpt: ChatGPT,
  'openai-codex': OpenAI,
  'openai-agents-sdk': OpenAI,
  'google-gemini-api': Google,
  'gemini-cli': Google,
  v0: { onLight: VercelDark, onDark: VercelLight },
  'vercel-ai-sdk': { onLight: VercelDark, onDark: VercelLight },

  // —— Specialized engineering ——
  cpp: CPlusPlus,
  rust: { onLight: RustDark, onDark: RustLight },
};

/**
 * The raw map entry for a technology: a component, a { onLight, onDark } pair, or null.
 * Prefer <TechnologyIcon /> unless you need to branch on whether a logo exists at all.
 */
export const getTechnologyIcon = (technology) => ICON_BY_SLUG[technology?.slug] || null;

/**
 * Name → technology record, built from the reference-data list (`useTechnologies`).
 *
 * Icons key off the stable slug, but several screens only ever carry technology
 * *names* — a staffing request's rows, an intern's skill list — and a name cannot
 * be turned into a slug by rule: `Vue.js` is `vue-js`, `C++` is `cpp`, `.NET` is
 * `dotnet`. Looking the name back up against reference data is the only lossless
 * route, and the query it comes from is shared and long-cached, so it costs
 * nothing extra to ask.
 *
 * Matched case-insensitively: a name is display text, not an identifier. Unknown
 * names simply miss, and <TechnologyIcon /> falls back to its neutral glyph.
 */
export const buildTechnologyIndex = (technologies = []) =>
  new Map(
    technologies
      .filter((technology) => technology?.name)
      .map((technology) => [technology.name.toLowerCase(), technology])
  );

/**
 * Renders a technology's brand logo, or a neutral fallback glyph for conceptual
 * technologies that have no single logo. `size` is in px.
 *
 * Monochrome logos render as a pair — one per theme, swapped with `dark:` utilities rather
 * than a theme hook, so the icon is correct on first paint and during hydration.
 */
export function TechnologyIcon({ technology, size = 14, className }) {
  const icon = getTechnologyIcon(technology);

  if (icon?.onLight) {
    const { onLight: OnLight, onDark: OnDark } = icon;
    return (
      <>
        <OnLight size={size} className={cn(className, 'dark:hidden')} />
        <OnDark size={size} className={cn(className, 'hidden dark:inline-block')} />
      </>
    );
  }

  const Icon = icon;
  if (Icon) return <Icon size={size} className={className} />;
  return <Code2 size={size} className={className} />;
}
