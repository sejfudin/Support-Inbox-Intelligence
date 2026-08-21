// The canonical Technology catalog. CV scanning can only ever surface technologies that
// exist here (see helpers/cvTechnologyMatcher.js), so this list is what decides how much of
// a real CV gets recognized — keep it broad enough to cover the mainstream stacks interns
// actually list. A skill with no entry below is invisible to the CV scan no matter how it is
// written. Languages and tooling sit alongside frameworks on purpose: interns list all of
// them on a CV, and a mentor can meaningfully assess readiness on any of them. Whole-discipline
// entries that duplicate a Position name ("DevOps", "Data Engineering", "Data Science",
// "Machine Learning") do NOT belong here — those are specializations (server/models/Position.js),
// not technologies, and createTechnology/createPosition now reject that overlap going forward
// (see helpers/roleCatalog.js). Narrower practice labels that don't name a specialization
// outright ("Manual QA", "Test Automation") are still fine.
//
// Adding an entry: give it an explicit `slug` whenever slugify(name) would be lossy or
// collide (`C#` and `C++` both slugify to `c`). Then add the CV aliases for that slug in
// helpers/cvTechnologyMatcher.js, and optionally a brand logo in
// frontend/src/helpers/technologyIcons.jsx. Finish with `npm run seed:technologies` to
// backfill databases that were already seeded — a non-destructive upsert.
//
// Slugs are the stable key — ReadinessFlags, CV aliases and icons all reference them, so
// never rename one in place. To replace a coarse entry with granular ones, add the new entries
// here and retire the old row with `npm run cleanup:superseded-technologies` (see
// retireSupersededTechnologies.js); left active, both match the same CV line and one skill is
// auto-declared as several technologies.
//
// Groups below are for human readability only; the API sorts by name. Entries that predate
// the "Languages"/"Databases" groups keep their original section.

module.exports = [
  // —— Languages ——
  { name: 'JavaScript' },
  { name: 'TypeScript' },
  { name: 'Python' },
  { name: 'Java' },
  { name: 'C#', slug: 'csharp' },
  { name: 'C', slug: 'c' },
  { name: 'PHP' },
  { name: 'Ruby' },
  { name: 'Scala' },
  { name: 'Elixir' },
  { name: 'Dart' },
  { name: 'R', slug: 'r' },
  { name: 'SQL' },

  // —— Frontend ——
  { name: 'React' },
  { name: 'Angular' },
  { name: 'Vue.js', slug: 'vue-js' },
  { name: 'Next.js', slug: 'next-js' },
  { name: 'Nuxt.js', slug: 'nuxt-js' },
  { name: 'Svelte' },
  { name: 'Astro' },
  { name: 'SolidJS', slug: 'solidjs' },
  { name: 'Redux' },
  { name: 'jQuery' },
  { name: 'HTML' },
  { name: 'CSS' },
  { name: 'Sass' },
  { name: 'Tailwind CSS', slug: 'tailwind-css' },
  { name: 'Bootstrap' },
  { name: 'Material UI', slug: 'material-ui' },

  // —— Backend ——
  { name: 'Node.js', slug: 'node-js' },
  { name: 'Express.js', slug: 'express-js' },
  { name: 'NestJS', slug: 'nestjs' },
  { name: 'Spring Boot', slug: 'spring-boot' },
  { name: '.NET', slug: 'dotnet' },
  { name: 'Django' },
  { name: 'FastAPI' },
  { name: 'Flask' },
  { name: 'Go' },
  { name: 'Laravel' },
  { name: 'Symfony' },
  { name: 'Ruby on Rails', slug: 'ruby-on-rails' },
  { name: 'GraphQL' },

  // —— Databases ——
  { name: 'PostgreSQL' },
  { name: 'MySQL' },
  { name: 'MongoDB' },
  { name: 'Redis' },
  { name: 'Microsoft SQL Server', slug: 'sql-server' },
  { name: 'Oracle Database', slug: 'oracle-database' },
  { name: 'Elasticsearch' },

  // —— Mobile ——
  { name: 'Kotlin' },
  { name: 'Swift' },
  { name: 'Android' },
  { name: 'iOS', slug: 'ios' },
  { name: 'React Native', slug: 'react-native' },
  { name: 'Flutter' },
  { name: 'Ionic' },
  { name: 'Xamarin' },

  // —— Data & analytics ——
  { name: 'Pandas' },
  { name: 'NumPy' },
  { name: 'Apache Spark', slug: 'apache-spark' },
  { name: 'Apache Airflow', slug: 'apache-airflow' },
  { name: 'Apache Kafka', slug: 'apache-kafka' },
  { name: 'Power BI', slug: 'power-bi' },
  { name: 'Tableau' },

  // —— ML ——
  { name: 'TensorFlow' },
  { name: 'PyTorch' },
  { name: 'scikit-learn', slug: 'scikit-learn' },

  // —— QA ——
  { name: 'Manual QA', slug: 'manual-qa' },
  { name: 'Test Automation', slug: 'test-automation' },
  { name: 'Selenium' },
  { name: 'Cypress' },
  { name: 'Playwright' },
  { name: 'Jest' },
  { name: 'JUnit' },
  { name: 'Postman' },

  // —— DevOps & cloud ——
  { name: 'Docker' },
  { name: 'Kubernetes' },
  { name: 'AWS' },
  { name: 'Microsoft Azure', slug: 'azure' },
  { name: 'Google Cloud', slug: 'google-cloud' },
  { name: 'Terraform' },
  { name: 'Ansible' },
  { name: 'Jenkins' },
  { name: 'GitHub Actions', slug: 'github-actions' },
  { name: 'GitLab CI', slug: 'gitlab-ci' },
  { name: 'Linux' },
  { name: 'Nginx' },

  // —— Tooling ——
  { name: 'Git' },

  // —— Specialized engineering ——
  { name: 'C++', slug: 'cpp' },
  { name: 'Rust' },
];
