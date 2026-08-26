/**
 * Finding every `ref: 'User'` in the database, and deciding what a repair script
 * may do with each one.
 *
 * Two scripts share this. `cleanupOrphanedUserRefs.js` deletes what a departed
 * user owned and clears what it may; `repointOrphanedUserRefs.js` points the rest
 * at a tombstone user instead. They have to agree on *what is out there* and on
 * *which refs describe a real event*, so both questions are answered here rather
 * than twice.
 *
 * The schema walk in particular is not code to reimplement from memory. It has
 * already been wrong once: checking only top-level `options.ref` plus the array
 * caster found 27 of 35 refs and reported "no dangling refs" while eight kinds of
 * them dangled. The comments on `userRefPaths` say why each branch is there.
 */

const mongoose = require('mongoose');

/**
 * The model, or null when this branch does not have it. The tables below name
 * models by string so the cascade is readable in one glance, but not every
 * branch carries every model — `master` has no Attendance or AbsenceRequest —
 * and `mongoose.model()` throws on an unregistered name. Skipping what is not
 * there beats maintaining a per-branch copy of a script.
 */
const modelIfPresent = (name) =>
  mongoose.modelNames().includes(name) ? mongoose.model(name) : null;

/**
 * Records keyed to an InternProfile. When the profile goes, these go with it —
 * each one describes that intern and nothing else, and a recommendation or an
 * attendance row pointing at a profile that no longer exists is the same ghost
 * one step removed.
 */
const PROFILE_DEPENDENTS = [
  ['Recommendation', 'internProfile'],
  ['Evaluation', 'internProfile'],
  ['MentorComment', 'internProfile'],
  ['ReadinessFlag', 'internProfile'],
  ['Attendance', 'intern'],
  ['AbsenceRequest', 'intern'],
];

/**
 * Per-user rows that mean nothing once their owner is gone: a refresh token
 * nobody can present, a notification with no one to read it, a cached AI summary
 * of a deleted profile, an invitation to an account that no longer exists.
 */
const USER_OWNED = [
  ['RefreshToken', 'user'],
  ['Notification', 'recipient'],
  ['AISummary', 'user'],
  ['Invitation', 'user'],
];

/**
 * Whether a finding names a ref that describes something a user *did* or somewhere
 * they *belonged* — `updatedBy`, `evaluator`, `Ticket.creator`, `Workspace.owner`,
 * workspace members, ticket message senders — as opposed to `InternProfile.user`
 * (the profile *is* that person, so the profile goes) or a `USER_OWNED` row (the
 * whole record goes).
 *
 * This is the line both scripts are drawn along, from opposite sides. The cleanup
 * script deletes what this returns false for and leaves the rest; the repoint
 * script repoints what this returns true for and refuses the rest. A record whose
 * whole subject is gone must not acquire a tombstone — an InternProfile owned by
 * "Deleted user" is a ghost intern, which is the bug, not the fix.
 */
const isAuthorshipRef = ({ modelName, refPath }) =>
  !(modelName === 'InternProfile' && refPath === 'user') &&
  !USER_OWNED.some(([name, field]) => name === modelName && field === refPath);

/**
 * Every schema path on a schema that is a `ref: 'User'` — scalar, array of ids,
 * or buried in a sub-document. Recurses, because `eachPath` reports an embedded
 * document or a document array as a single node and never yields the paths
 * inside it: without the descent, `Workspace.members[].user`,
 * `Ticket.messages[].sender` and `Ticket.reviewRequest.reviewer` are all invisible
 * and a script reports "no dangling refs" while they dangle.
 *
 * Each entry carries what a repair step needs to decide, resolved here where the
 * SchemaType is in hand: `Model.schema.path()` does not resolve a dotted
 * sub-document path, so a lookup after the fact reads `undefined` and silently
 * loses the `required` flag.
 *
 * - `isArray`    — the field itself holds a list of ids (`$pull`, not `$unset`).
 * - `inDocArray` — the field sits inside a document array, so its dotted path is
 *                  not directly writable; a positional `arrayFilters` update is
 *                  the only way to write it in place.
 * - `isRequired` — clearing it would leave the record invalid.
 *
 * For a ref inside a document array, knowing *that* it is inside one is not
 * enough to write it — an `arrayFilters` update needs the array's own path and
 * the leaf path within an element, spelled separately:
 *
 *   { $set: { 'members.$[m].user': id } }, { arrayFilters: [{ 'm.user': ... }] }
 *
 * so the walk records both while it still knows where the boundary was. Splitting
 * a dotted path after the fact cannot recover it: `reviewRequest.reviewer` and
 * `members.user` look identical from the outside, and only one of them has an
 * array in the middle.
 *
 * - `docArrayPath`   — path of the *nearest* enclosing document array.
 * - `leafPath`       — the rest of the path, relative to one element of it.
 * - `nestedDocArray` — a second document array wraps the first. One `$[]`
 *                      placeholder cannot address two levels, so a repair step
 *                      must refuse these rather than write the wrong element.
 *                      Nothing in this schema set hits it today.
 */
const userRefPaths = (schema, prefix = '') => {
  const paths = [];

  schema.eachPath((pathName, type) => {
    const fullPath = prefix ? `${prefix}.${pathName}` : pathName;

    // Embedded document (`instance === 'Embedded'`) or document array
    // (`instance === 'Array'` with a schema) — descend.
    if (type.schema) {
      const isDocArray = type.instance === 'Array';
      paths.push(
        ...userRefPaths(type.schema, fullPath).map((entry) => ({
          ...entry,
          inDocArray: entry.inDocArray || isDocArray,
          // The innermost enclosing array wins, and a second one only sets the
          // flag: `docArrayPath` stays the one whose elements hold the leaf.
          nestedDocArray: entry.nestedDocArray || (isDocArray && Boolean(entry.docArrayPath)),
          docArrayPath: entry.docArrayPath ?? (isDocArray ? fullPath : null),
          leafPath: entry.leafPath ?? (isDocArray ? entry.path.slice(fullPath.length + 1) : null),
        }))
      );
      return;
    }

    // `[{ type: ObjectId, ref: 'User' }]` declares its ref on the array's
    // element options. Mongoose leaves `caster.options` empty for that form, so
    // read the declared type as well — checking only the caster misses it.
    const elementOptions = Array.isArray(type.options?.type) ? type.options.type[0] : null;
    const isScalarRef = type.options?.ref === 'User';
    const isArrayRef = type.caster?.options?.ref === 'User' || elementOptions?.ref === 'User';

    if (isScalarRef || isArrayRef) {
      paths.push({
        path: fullPath,
        isArray: Boolean(isArrayRef),
        inDocArray: false,
        isRequired: Boolean(type.isRequired),
        nestedDocArray: false,
        docArrayPath: null,
        leafPath: null,
      });
    }
  });

  return paths;
};

/**
 * Read a possibly-dotted path out of a lean document. Walking through an array
 * — `members.user` over `members: [...]` — collects the key from every element,
 * which is how a ref inside a document array is read at all.
 */
const readPath = (doc, pathName) =>
  pathName.split('.').reduce((value, key) => {
    if (value == null) return value;
    if (Array.isArray(value)) {
      return value.flatMap((entry) => (entry == null ? [] : [entry[key]]));
    }
    return value[key];
  }, doc);

/**
 * Every dangling `ref: 'User'` in the database, grouped by model and path.
 * `liveUserIds` is passed in as a Set of strings — one read of the users
 * collection serves the whole scan.
 */
const scanDanglingUserRefs = async (liveUserIds) => {
  const findings = [];

  for (const modelName of mongoose.modelNames()) {
    const Model = mongoose.model(modelName);
    for (const refDescriptor of userRefPaths(Model.schema)) {
      const { path: refPath } = refDescriptor;
      const docs = await Model.find({ [refPath]: { $ne: null } })
        .select(refPath)
        .lean();

      const dangling = [];
      for (const doc of docs) {
        const value = readPath(doc, refPath);
        const ids = Array.isArray(value) ? value : [value];
        for (const id of ids) {
          if (!id) continue;
          const userId = String(id?._id ?? id);
          if (!liveUserIds.has(userId)) dangling.push({ docId: String(doc._id), userId });
        }
      }

      // Spread the descriptor rather than re-listing its fields: a flag added to
      // the walk has to reach the repair steps, and the last time this was a
      // hand-written list a flag went missing on the way through.
      if (dangling.length) findings.push({ modelName, ...refDescriptor, refPath, dangling });
    }
  }

  return findings;
};

/** The distinct missing user ids in a finding, as strings. */
const missingIdsOf = ({ dangling }) => [...new Set(dangling.map((entry) => entry.userId))];

module.exports = {
  modelIfPresent,
  PROFILE_DEPENDENTS,
  USER_OWNED,
  isAuthorshipRef,
  userRefPaths,
  readPath,
  scanDanglingUserRefs,
  missingIdsOf,
};
