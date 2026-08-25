const Hub = require('../models/Hub');
const InternshipType = require('../models/InternshipType');
const Technology = require('../models/Technology');
const Position = require('../models/Position');
const { slugify } = require('../helpers/slugify');
const DEFAULT_TECHNOLOGIES = require('./defaultTechnologies');
const DEFAULT_POSITIONS = require('./defaultPositions');

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

const seedTechnologies = async () => {
  for (const entry of DEFAULT_TECHNOLOGIES) {
    const name = typeof entry === 'string' ? entry : entry.name;
    const slug = typeof entry === 'string' ? slugify(name) : entry.slug || slugify(name);
    await Technology.updateOne({ slug }, { $setOnInsert: { name, slug } }, { upsert: true });
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
