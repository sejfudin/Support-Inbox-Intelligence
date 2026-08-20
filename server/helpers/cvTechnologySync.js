// Merges a fresh CV scan into the technologies an intern has declared.
//
// A scan only ever ADDS. Everything the intern already has — declared by hand or picked up by an
// earlier scan — survives every re-upload: one whose text mentions none of it, and one whose text
// mentions nothing at all. Uploading a CV is the intern handing over more evidence about
// themselves, never a statement that whatever is missing from the new PDF is gone. Shortening the
// list stays a deliberate act, done on the technologies screen (`updateSelfTechnologies`).
//
// That is also why no CV-vs-manual provenance is recorded: nothing needs to know which of the two
// put a technology on the list, because neither one can take it off.
//
// Pure on purpose (ids and plain objects in, ids and plain objects out) — the DB/storage work
// stays in internCvService. See cvTechnologySync.test.js.

const toId = (value) => String(value?._id ?? value);

// selfTechnologies: the profile's current value (ObjectIds or populated docs).
// matched: technologies the new CV mentions, as objects carrying at least `_id` (from
// helpers/cvTechnologyMatcher). Returns the next value for the profile field plus the
// technologies this scan actually contributed, for the caller to report back to the UI.
const mergeCvTechnologies = ({ selfTechnologies = [], matched = [] }) => {
  // The existing list, in its existing order (deduped defensively — a legacy profile can hold
  // the same ref twice, and this is one of the two places that rewrites the list).
  const kept = [];
  const keptIds = new Set();
  for (const value of selfTechnologies.filter(Boolean)) {
    const id = toId(value);
    if (keptIds.has(id)) continue;
    keptIds.add(id);
    kept.push(id);
  }

  // New arrivals only: a technology the CV mentions that is already declared is not an addition,
  // and must not be reported as one — the intern would read "added React" about a React they
  // have had on the list for weeks.
  const added = [];
  const addedIds = new Set();
  for (const tech of matched.filter(Boolean)) {
    const id = toId(tech);
    if (keptIds.has(id) || addedIds.has(id)) continue;
    addedIds.add(id);
    added.push(tech);
  }

  return {
    selfTechnologies: [...kept, ...added.map(toId)],
    addedTechnologies: added,
  };
};

module.exports = { mergeCvTechnologies };
