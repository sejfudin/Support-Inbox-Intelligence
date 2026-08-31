const Hub = require('../models/Hub');
const InternshipType = require('../models/InternshipType');
const Technology = require('../models/Technology');
const Position = require('../models/Position');
const { slugify } = require('../helpers/slugify');
const DEFAULT_TECHNOLOGIES = require('./defaultTechnologies');
const DEFAULT_POSITIONS = require('./defaultPositions');
const { DEFAULT_TECHNOLOGY_CATEGORY } = require('../constants/technologies');

const DEFAULT_HUBS = [
  { name: 'Belgrade', city: 'Belgrade', country: 'Serbia' },
  { name: 'Novi Sad', city: 'Novi Sad', country: 'Serbia' },
  { name: 'Niš', city: 'Niš', country: 'Serbia' },
  { name: 'Sarajevo', city: 'Sarajevo', country: 'Bosnia and Herzegovina' },
  { name: 'Banja Luka', city: 'Banja Luka', country: 'Bosnia and Herzegovina' },
  { name: 'Skopje', city: 'Skopje', country: 'North Macedonia' },
  { name: 'Medellín', city: 'Medellín', country: 'Colombia' },
];

const DEFAULT_INTERNSHIP_TYPES = [
  {
    slug: 'fep',
    name: 'Future Experts Program',
    description: 'Standard FEP internship track.',
    isSystem: true,
  },
  {
    slug: 'shadow',
    name: 'Shadow',
    description: 'Shadow internship program.',
    isSystem: true,
  },
  {
    slug: 'industrial',
    name: 'Industrial',
    description: 'Industrial internship.',
    isSystem: true,
  },
  {
    slug: 'one-on-one',
    name: '1-on-1',
    description: 'Individual mentorship internship track.',
    isSystem: true,
  },
  {
    slug: 'core-tool',
    name: 'Core Tool',
    description: 'Core tool internship track.',
    isSystem: true,
  },
];

const seedHubs = async () => {
  for (const hub of DEFAULT_HUBS) {
    await Hub.updateOne({ name: hub.name }, { $setOnInsert: hub }, { upsert: true });
  }
};

const seedInternshipTypes = async () => {
  for (const type of DEFAULT_INTERNSHIP_TYPES) {
    await InternshipType.updateOne({ slug: type.slug }, { $setOnInsert: type }, { upsert: true });
  }
};

const technologyCategory = (entry) =>
  (typeof entry === 'string' ? undefined : entry.category) || DEFAULT_TECHNOLOGY_CATEGORY;

// `category` is written on insert and BACKFILLED onto rows that predate the field (they carry
// none at all) — that is what moves the six entries the AI skills group pulled out of the
// technology half into the right catalog on databases seeded before it. It is NOT re-asserted
// on a row that already has a category: an admin can move a row between the two halves from
// Reference Data, and the next sync has to leave that choice alone. Name and slug are
// insert-only for the same reason — a rename made in the app is never stomped.
//
// `category` as an ARGUMENT narrows which catalog entries are considered at all — the rest are
// not read, not upserted, and their existing rows are not written to. That is the difference
// that matters on a shared database: seeding the AI half leaves every other row, including its
// `updatedAt`, exactly as it was.
const seedTechnologies = async ({ category: only } = {}) => {
  for (const entry of DEFAULT_TECHNOLOGIES) {
    const category = technologyCategory(entry);
    if (only && category !== only) continue;
    const name = typeof entry === 'string' ? entry : entry.name;
    const slug = typeof entry === 'string' ? slugify(name) : entry.slug || slugify(name);
    await Technology.updateOne(
      { slug },
      { $setOnInsert: { name, slug, category } },
      { upsert: true }
    );
    // Backfill onto a row seeded before the field existed. Only the non-default half needs it —
    // a missing category already reads as `general` everywhere (see constants/technologies) —
    // and `{ category: null }` matches missing-or-null only, so a row an admin has categorised
    // is never touched.
    if (category !== DEFAULT_TECHNOLOGY_CATEGORY) {
      await Technology.updateOne({ slug, category: null }, { $set: { category } });
    }
  }
};

const seedPositions = async () => {
  for (const { name, slug } of DEFAULT_POSITIONS) {
    await Position.updateOne({ slug }, { $setOnInsert: { name, slug } }, { upsert: true });
  }
};

const seedReferenceData = async () => {
  await seedHubs();
  await seedInternshipTypes();
  await seedTechnologies();
  await seedPositions();
};

module.exports = {
  seedHubs,
  seedInternshipTypes,
  seedTechnologies,
  seedPositions,
  seedReferenceData,
};
