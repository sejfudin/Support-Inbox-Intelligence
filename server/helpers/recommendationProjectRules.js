// Pure rules for setting/editing `Recommendation.project`. No I/O — callers
// resolve ids and load documents; this only decides what is legal. Follows
// `helpers/specializationRules.js` and `helpers/staffingRequestRules.js`.
//
// `null` is the stored meaning of "project not known yet" (see
// `.claude/docs/architecture.md` § "Project"). A client must always assert one
// of the two — an explicit project id, or an explicit `null` for "unknown" —
// never omit the field, so a dropped field or a stale client can't produce an
// indistinguishable, legitimate-looking "unknown".

const idEquals = (a, b) => String(a ?? '') === String(b ?? '');

// The two intern-facing spellings of "we don't know the project yet" — the
// server formatter emits the label form, notifications interpolate the phrase
// form mid-sentence with its article already in place. Kept together so every
// surface an intern reaches says the same thing. Internal (admin/mentor) copy
// is a separate helper, `recommendationProjectLabel` in
// `frontend/src/helpers/recommendations.js` — deliberately worded softer here,
// since this is what an intern reads rather than an admin's note to themself.
const PROJECT_TO_BE_CONFIRMED_LABEL = 'Project to be confirmed';
const PROJECT_TO_BE_CONFIRMED_PHRASE = 'a project to be confirmed';

// A create (ad-hoc or via a staffing request) must assert one of the two.
// `rawValue` is exactly what the payload carried for the project field —
// `undefined` means the field was left out entirely.
const assertProjectFieldAsserted = (rawValue) => {
  if (rawValue === undefined) {
    throw new Error('Project must be set or explicitly marked unknown');
  }
};

// Whether an edit to `project` is legal, given the recommendation's current
// status and project. Free while the recommendation is still in selection
// (`recommended`/`interviewing`). Once `resulted`, the field is locked, with
// one exception: a project that was never known can still be filled in —
// filling a null adds an intern to a roster they were always missing from,
// while clearing or swapping a known project takes one off a roster they were
// counted on, silently changing recorded placement figures.
const assertCanEditProject = ({ status, currentProjectId, nextProjectId }) => {
  if (status !== 'resulted') return;
  if (idEquals(currentProjectId, nextProjectId)) return;
  if (currentProjectId) {
    throw new Error('Project is locked once a recommendation is resulted');
  }
};

module.exports = {
  assertProjectFieldAsserted,
  assertCanEditProject,
  PROJECT_TO_BE_CONFIRMED_LABEL,
  PROJECT_TO_BE_CONFIRMED_PHRASE,
};
