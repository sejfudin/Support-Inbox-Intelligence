// The two catalogs behind one Technology collection.
//
// `ai` marks the AI skills — coding agents, assistant IDEs, LLM APIs and the practices
// around them. They are technologies in every way that matters (declared by interns,
// assessed by mentors, staffed on requests); the category only decides which search box
// finds a row and which section lists it. See server/models/Technology.js.
//
// Rows seeded before the field existed have no `category` at all, so anything that is not
// explicitly `ai` reads as general — never filter general with `{ category: 'general' }`.
const TECHNOLOGY_CATEGORIES = ['general', 'ai'];
const DEFAULT_TECHNOLOGY_CATEGORY = 'general';
const AI_TECHNOLOGY_CATEGORY = 'ai';

module.exports = {
  TECHNOLOGY_CATEGORIES,
  DEFAULT_TECHNOLOGY_CATEGORY,
  AI_TECHNOLOGY_CATEGORY,
};
