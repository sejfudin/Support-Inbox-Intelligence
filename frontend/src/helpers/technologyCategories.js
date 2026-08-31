/**
 * The catalog is one collection with two halves: technologies and AI skills.
 *
 * Mirrors `server/constants/technologies.js`. A row's `category` decides which search box
 * finds it and which section lists it, and nothing else — an AI skill is declared, assessed
 * and staffed exactly like any other technology.
 *
 * Rows seeded before the field existed carry no `category` at all, so general is read as
 * "not AI" rather than as the literal string. Never filter the general half with
 * `category === 'general'`: on an un-reseeded database that returns nothing.
 */
export const AI_TECHNOLOGY_CATEGORY = 'ai';

export const isAiSkill = (technology) => technology?.category === AI_TECHNOLOGY_CATEGORY;

/** `{ technologies, aiSkills }` — one pass, input order preserved in both halves. */
export const splitByCategory = (list = []) => ({
  technologies: list.filter((entry) => !isAiSkill(entry)),
  aiSkills: list.filter(isAiSkill),
});
