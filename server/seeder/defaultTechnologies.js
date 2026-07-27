// The canonical Technology catalog. This list is the ceiling for CV auto-detection —
// `helpers/cvTechnologyMatcher.js` can only ever return technologies that exist here, so a
// skill with no entry below is silently invisible to the CV scan no matter how it is written.
// Add the entry here AND an alias entry in the matcher, then run `npm run seed:technologies`
// to backfill databases that were already seeded (non-destructive upsert).
//
// Languages and tooling sit alongside frameworks and disciplines on purpose: interns list all
// of them on a CV, and a mentor can meaningfully assess readiness on any of them.

module.exports = [
  // —— Languages ——
  { name: 'JavaScript' },
  { name: 'TypeScript' },
  { name: 'Python' },
  { name: 'Java' },
  { name: 'C#', slug: 'csharp' },
  { name: 'PHP', slug: 'php' },
  { name: 'Ruby' },
  { name: 'SQL', slug: 'sql' },

  // —— Frontend ——
  { name: 'React' },
  { name: 'Angular' },
  { name: 'Vue.js', slug: 'vue-js' },
  { name: 'Next.js', slug: 'next-js' },
  { name: 'Svelte' },
  { name: 'HTML & CSS', slug: 'html-css' },
  { name: 'Redux' },
  { name: 'Tailwind CSS', slug: 'tailwind-css' },

  // —— Backend ——
  { name: 'Node.js', slug: 'node-js' },
  { name: 'Spring Boot', slug: 'spring-boot' },
  { name: '.NET', slug: 'dotnet' },
  { name: 'Django' },
  { name: 'FastAPI' },
  { name: 'Go' },
  { name: 'Laravel' },
  { name: 'Ruby on Rails', slug: 'ruby-on-rails' },

  // —— Mobile ——
  { name: 'Kotlin' },
  { name: 'Swift' },
  { name: 'React Native', slug: 'react-native' },
  { name: 'Flutter' },

  // —— Databases ——
  { name: 'MongoDB' },
  { name: 'PostgreSQL' },

  // —— Data & analytics ——
  { name: 'Data Engineering', slug: 'data-engineering' },
  { name: 'Data Science', slug: 'data-science' },

  // —— ML ——
  { name: 'Machine Learning', slug: 'machine-learning' },

  // —— QA ——
  { name: 'Manual QA', slug: 'manual-qa' },
  { name: 'Test Automation', slug: 'test-automation' },
  { name: 'Jest' },
  { name: 'Cypress' },
  { name: 'Selenium' },

  // —— DevOps & cloud ——
  { name: 'DevOps' },
  { name: 'Docker' },
  { name: 'Kubernetes' },
  { name: 'AWS', slug: 'aws' },

  // —— Tooling ——
  { name: 'Git' },

  // —— Specialized engineering ——
  { name: 'C++', slug: 'cpp' },
  { name: 'Rust' },
];
