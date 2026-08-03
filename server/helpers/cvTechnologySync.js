// Reconciles an intern's declared technologies against a fresh CV scan.
//
// A re-uploaded CV must *replace* what the previous scan contributed, not pile on top of it.
// That needs provenance, because `InternProfile.selfTechnologies` mixes two sources: what the
// intern declared by hand and what a CV scan added for them. `InternProfile.cvTechnologies`
// carries that provenance — the subset of `selfTechnologies` the latest scan owns.
//
// Ownership rule: a technology is CV-owned only if a scan is what put it there. One the intern
// had already declared before a scan happened to match it stays theirs forever, so a later CV
// that drops the mention can never delete their manual declaration.
//
// Pure on purpose (ids and plain objects in, ids and plain objects out) — the DB/storage work
// stays in internCvService. See cvTechnologySync.test.js.

const toId = (value) => String(value?._id ?? value);

// selfTechnologies / cvTechnologies: current profile values (ObjectIds or populated docs).
// matched: technologies the new CV mentions, as objects carrying at least `_id` (from
// helpers/cvTechnologyMatcher). Returns the next value for both profile fields plus the
// added/removed deltas, for the caller to report back to the UI.
const reconcileCvTechnologies = ({ selfTechnologies = [], cvTechnologies = [], matched = [] }) => {
  const matchedById = new Map(matched.filter(Boolean).map((tech) => [toId(tech), tech]));
  const ownedByCv = new Set(cvTechnologies.filter(Boolean).map(toId));

  // The "old technologies" to drop: CV-owned, and the new scan no longer mentions them.
  const removedIds = [...ownedByCv].filter((id) => !matchedById.has(id));
  const removed = new Set(removedIds);

  // Everything else the intern keeps, in its existing order (deduped defensively — a legacy
  // profile can hold the same ref twice, and this is the one place that rewrites the list).
  const kept = [];
  const keptIds = new Set();
  for (const value of selfTechnologies.filter(Boolean)) {
    const id = toId(value);
    if (removed.has(id) || keptIds.has(id)) continue;
    keptIds.add(id);
    kept.push(id);
  }

  const addedIds = [...matchedById.keys()].filter((id) => !keptIds.has(id));
  const added = new Set(addedIds);

  return {
    selfTechnologies: [...kept, ...addedIds],
    // CV-owned from here on: what this scan just added, plus what it re-confirmed from the
    // previous scan. Matched-but-manually-declared technologies are deliberately excluded.
    cvTechnologies: [...matchedById.keys()].filter((id) => added.has(id) || ownedByCv.has(id)),
    addedTechnologies: addedIds.map((id) => matchedById.get(id)),
    removedTechnologyIds: removedIds,
  };
};

module.exports = { reconcileCvTechnologies };
