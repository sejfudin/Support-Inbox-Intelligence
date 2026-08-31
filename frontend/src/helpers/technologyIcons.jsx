import { Code2, Sparkles, Zap } from 'lucide-react';
import {
  siClaudecode,
  siCline,
  siCoderabbit,
  siCursor,
  siGooglegemini,
  siJetbrains,
  siLangchain,
  siLanggraph,
  siModelcontextprotocol,
  siOllama,
  siPerplexity,
  siReplit,
  siWindsurf,
} from 'simple-icons';
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
import { isAiSkill } from '@/helpers/technologyCategories';
import { AI_BRAND_MARKS } from '@/helpers/aiBrandMarks';

// Maps a Technology (by its stable slug) to a brand logo from `developer-icons`.
//
// A value is either a single component, or a { onLight, onDark } pair for logos that are
// solid black or solid white — `developer-icons` ships those as two variants, and picking
// one would make the logo invisible in the other theme.
//
/**
 * A path-data mark as a component, so the map can hold it like any other icon.
 *
 * `developer-icons` carries the mainstream stacks but almost none of the AI tooling — no
 * Cursor, Windsurf, Cline, Perplexity, Replit, LangChain or MCP — which is why this file now
 * draws from two more sources. Both are data rather than components (`simple-icons` entries
 * are `{ title, hex, path }`; `aiBrandMarks.js` holds `{ paths }`), so the SVG shell is ours
 * to write, and one shell serves both.
 *
 * Rendered in `currentColor`, NOT a brand `hex`. Half of these marks are near-black
 * (Anthropic, Cursor, Vercel) and would vanish against a dark panel, and the alternative is
 * the onLight/onDark pair every monochrome logo above needs. Inheriting the text colour makes
 * the theme problem disappear instead of solving it twice per icon.
 *
 * `evenodd` because the marks that carry a cut-out (Devin's stacked tiles, LlamaIndex's loop)
 * are drawn expecting it; it is harmless for the single-path ones.
 *
 * A `<title>` is deliberately omitted: every call site already renders the technology's name
 * beside the mark, so one would have a screen reader read it twice.
 */
const pathIcon =
  (paths) =>
  ({ size = 14, className }) => (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      fillRule="evenodd"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );

/** A `simple-icons` entry (single path) as a component. */
const simpleIcon = ({ path }) => pathIcon([path]);

/** One of the marks transcribed in `aiBrandMarks.js`, by catalog slug. */
const brandMark = (slug) => pathIcon(AI_BRAND_MARKS[slug].paths);

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
  // `openai-api` used to live here; it is in the AI skills group below now, with the catalog.

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
  // Two sets feed this group. The vendor marks below come from `developer-icons` like every
  // group above; the young agent tools come from `simple-icons` through `simpleIcon()`, which
  // is the whole reason that dependency is here — `developer-icons` carries none of them.
  //
  // Where a vendor ships several entries they share the vendor's mark: Codex and the Agents
  // SDK are both OpenAI, v0 and the AI SDK are both Vercel, the Gemini API and its CLI are
  // both Gemini. Two rows with one logo is correct here — the name beside it distinguishes
  // them. Claude Code is the exception: it has a mark of its own, so it does not borrow
  // Anthropic's.
  //
  // Amazon Q Developer takes the AWS mark on the same principle — it is an AWS product and
  // the Q logo is not in either set.
  'claude-code': simpleIcon(siClaudecode),
  'anthropic-claude-api': Anthropic,
  'claude-agent-sdk': Anthropic,
  'github-copilot': GitHubCopilot,
  'github-copilot-agent-mode': GitHubCopilot,
  chatgpt: ChatGPT,
  'openai-codex': OpenAI,
  'openai-agents-sdk': OpenAI,
  'openai-api': OpenAI,
  'google-gemini-api': simpleIcon(siGooglegemini),
  'gemini-cli': simpleIcon(siGooglegemini),
  cursor: simpleIcon(siCursor),
  windsurf: simpleIcon(siWindsurf),
  cline: simpleIcon(siCline),
  perplexity: simpleIcon(siPerplexity),
  'jetbrains-ai-assistant': simpleIcon(siJetbrains),
  'replit-agent': simpleIcon(siReplit),
  'amazon-q-developer': AWS,
  mcp: simpleIcon(siModelcontextprotocol),
  langchain: simpleIcon(siLangchain),
  langgraph: simpleIcon(siLanggraph),
  ollama: simpleIcon(siOllama),
  'ai-code-review': simpleIcon(siCoderabbit),
  v0: { onLight: VercelDark, onDark: VercelLight },
  'vercel-ai-sdk': { onLight: VercelDark, onDark: VercelLight },
  devin: brandMark('devin'),
  llamaindex: brandMark('llamaindex'),
  lovable: brandMark('lovable'),
  // No mark exists for Bolt.new in any of the three sources, but its name *is* the glyph.
  // Aider has neither, and falls through to the AI fallback below along with the practice
  // rows (Agent Skills, prompt engineering, RAG, evals, orchestration, LLMs) — those name a
  // way of working rather than a product, so there is no logo to be missing.
  'bolt-new': Zap,

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
 *
 * The fallback forks on the category: an AI skill with no mark gets a spark rather than the
 * `</>` glyph, because most of the unmarked entries in that half are practices (Agent Skills,
 * prompt engineering, evals, agent orchestration) and a code glyph reads as "a framework I
 * have not heard of". A row that arrives as a bare name — several screens carry only the
 * technology's name — has no category to fork on and keeps the code glyph.
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

  const Fallback = isAiSkill(technology) ? Sparkles : Code2;
  return <Fallback size={size} className={className} />;
}
