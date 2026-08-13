import { Code2 } from 'lucide-react';
import {
  AWS,
  Android,
  Angular,
  Ansible,
  AppleDark,
  AppleLight,
  Astro,
  Azure,
  Bootstrap5,
  C,
  CPlusPlus,
  CSS3,
  CSharp,
  Cypress,
  Dart,
  Django,
  Docker,
  Elastic,
  Elixir,
  ExpressJsDark,
  ExpressJsLight,
  FastAPI,
  FlaskDark,
  FlaskLight,
  Flutter,
  Git,
  GitHubDark,
  GitHubLight,
  GitLab,
  Go,
  GoogleCloud,
  GraphQL,
  HTML5,
  Ionic,
  JQuery,
  Java,
  JavaScript,
  Jenkins,
  Jest,
  Kafka,
  Kotlin,
  Kubernetes,
  Laravel,
  Linux,
  MaterialUI,
  MicrosoftSQLServer,
  MongoDB,
  MySQL,
  NestJS,
  NextJs,
  NodeJs,
  NumPy,
  NuxtJs,
  Oracle,
  PHP,
  Playwright,
  PostgreSQL,
  Postman,
  PyTorch,
  Python,
  R,
  Rails,
  React as ReactIcon,
  Redis,
  Redux,
  Ruby,
  RustDark,
  RustLight,
  Sass,
  Scala,
  SolidJS,
  Spring,
  Swift,
  SvelteJS,
  SymfonyDark,
  SymfonyLight,
  TailwindCSS,
  Tensorflow,
  Terraform,
  TypeScript,
  VueJs,
  Xamarin,
} from 'developer-icons';
import { cn } from '@/lib/utils';

// Maps a Technology (by its stable slug) to a brand logo from `developer-icons`.
//
// A value is either a single component, or a { onLight, onDark } pair for logos that are
// solid black or solid white — `developer-icons` ships those as two variants, and picking
// one would make the logo invisible in the other theme.
//
// Technologies that are conceptual rather than a single product (Data Engineering, Machine
// Learning, Manual QA, DevOps, SQL, …) intentionally have no entry, and neither do the few
// products the icon set does not cover (Selenium, Tableau, Power BI, Nginx, pandas,
// scikit-learn, Spark, Airflow, JUnit). Both fall back to a neutral code glyph via
// TechnologyIcon below.
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

  // —— Databases ——
  postgresql: PostgreSQL,
  mysql: MySQL,
  mongodb: MongoDB,
  redis: Redis,
  'sql-server': MicrosoftSQLServer,
  'oracle-database': Oracle,
  elasticsearch: Elastic,

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

  // —— QA ——
  cypress: Cypress,
  playwright: Playwright,
  jest: Jest,
  postman: Postman,

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

  // —— Tooling ——
  git: Git,

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
