// Ranks existing projects against a draft name so the admin resolve-project
// flow can show "maybe this already exists" before "create new" is ever
// offered — the most expensive mistake available there is a duplicate
// project, so a near-duplicate has to surface first. Pure: the caller passes
// in whatever project list it already has loaded.

const normalize = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const levenshtein = (a, b) => {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previousRow = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const currentRow = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currentRow.push(
        Math.min(currentRow[j - 1] + 1, previousRow[j] + 1, previousRow[j - 1] + cost)
      );
    }
    previousRow = currentRow;
  }
  return previousRow[b.length];
};

const similarity = (a, b) => {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const distance = levenshtein(a, b);
  const longest = Math.max(a.length, b.length);
  return longest === 0 ? 1 : 1 - distance / longest;
};

/**
 * `projects` is any list of `{ _id, name }`-shaped objects. Returns the ones
 * scoring above the threshold, highest first.
 */
export const matchProjectsByName = (name, projects = [], { threshold = 0.4, limit = 5 } = {}) => {
  const query = normalize(name);
  if (!query) return [];

  return projects
    .map((project) => {
      const candidate = normalize(project.name);
      let score = similarity(query, candidate);
      if (candidate.includes(query) || query.includes(candidate)) {
        score = Math.max(score, 0.85);
      }
      return { project, score };
    })
    .filter((entry) => entry.score >= threshold)
    .sort((a, b) => b.score - a.score || a.project.name.localeCompare(b.project.name))
    .slice(0, limit);
};
