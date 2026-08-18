const internService = require('./internService');
const evaluationService = require('./evaluationService');
const recommendationService = require('./recommendationService');
const readinessFlagService = require('./readinessFlagService');
const mentorCommentService = require('./mentorCommentService');
const { averageDelta, criterionTrends } = require('../helpers/evaluationTrend');
const {
  buildTechnologyReadiness,
  buildPositionReadiness,
  summarizeReadiness,
} = require('../helpers/readinessSummary');

/**
 * "My progress" — everything the programme records *about* an intern, assembled
 * for the intern themselves.
 *
 * Read-only by construction, not by convention: this service only reads, the route
 * is a GET, and there is no write path anywhere near it. Evaluations, readiness and
 * recommendations stay admin-only to author (`evaluationService.createEvaluation`,
 * `readinessFlagService.upsertReadinessFlag`, the `requireRole(ADMIN)` guards on
 * `/api/recommendations`). Adding an intern-writable field to any of them is a
 * different decision from this one.
 *
 * Same security model as `internDashboardService`: the subject is always
 * `req.user`, there is no id or workspace parameter, and every underlying read is
 * one of the narrow self-only functions that resolves the intern from the
 * authenticated user. See `.claude/docs/security.md`.
 *
 * **`MentorComment` is here, but only the subset an author explicitly chose to
 * share.** A mentor note's default audience is still `visibleTo` — admin/mentor/
 * leadership recipients — and stays completely invisible to the intern. The one
 * exception is a note whose author set `visibleToIntern: true` at write time, a
 * separate field from `visibleTo` chosen deliberately per note; those are the only
 * ones `mentorCommentService.listComments` returns for an INTERN caller (it
 * ignores `visibleTo`/authorship entirely for that role — see the comment there).
 * This is exactly the "author-side visibility choice at write time" this comment
 * used to say didn't exist yet.
 */

/** `{ name, slug }` off a populated `Position`, or null. */
const positionRef = (position) =>
  position ? { name: position.name || '', slug: position.slug || '' } : null;

/**
 * The facts about where the intern stands in the programme.
 *
 * All of this is already readable by the intern through `GET /api/interns/me` —
 * it has simply never been shown anywhere as "where do I stand". Picked into a flat
 * shape rather than forwarding the profile so the page cannot start depending on
 * fields (`cvPath`, `documentationLinks`, the raw `user` object) that belong to
 * other screens.
 */
const buildProgramme = (profile) => ({
  status: profile.status,
  startDate: profile.startDate || null,
  expectedEndDate: profile.expectedEndDate || null,
  // First day on a real project. Routinely in the FUTURE — it is set as soon as a
  // start date is known — so anything asking "are they on a project yet?" must
  // compare it against today rather than test it for truthiness. The page prints
  // it as a date and draws no conclusion from it.
  placedAt: profile.placedAt || null,
  internshipType: profile.internshipType?.name || '',
  hub: profile.user?.hub?.name || '',
  primaryMentor: profile.primaryMentor?.fullname || '',
  position: positionRef(profile.declaredPosition),
  secondaryPosition: positionRef(profile.secondaryPosition),
  // `specializationAssignedAt` is the ONLY marker that a specialization exists —
  // never `secondaryMentor` on its own, which predates the repurposing and can be
  // set on profiles that were never specialized. Once it is set, `declaredPosition`
  // *is* the confirmed specialization and `secondaryMentor` *is* its 1-on-1 mentor.
  // See docs/adr/0002-specialization-repurposes-secondary-mentor.md.
  specialization: profile.specializationAssignedAt
    ? {
        position: positionRef(profile.declaredPosition),
        mentor: profile.secondaryMentor?.fullname || '',
        assignedAt: profile.specializationAssignedAt,
      }
    : null,
});

/**
 * The full evaluation history plus the movement since the previous period.
 *
 * `items` is every period, newest first — this page is the history, unlike the
 * dashboard card which shows the latest and counts the rest. Each item is
 * `formatOwnEvaluation`'s redacted shape, which now includes the mentor's written
 * notes; see the comment on that formatter for why that changed.
 */
const buildEvaluations = async (user) => {
  const items = await evaluationService.listOwnEvaluations(user);

  return {
    total: items.length,
    latest: items[0] || null,
    // Both are computed from the same newest-first list the page renders, so a
    // chip can never disagree with the two rows it sits above.
    averageDelta: averageDelta(items),
    trends: criterionTrends(items),
    items,
  };
};

/**
 * Readiness for the intern's declared position and each declared technology.
 *
 * Driven by what the intern has *declared*, joined to the flags a mentor recorded —
 * so a technology nobody has assessed yet gets a "Not assessed" row rather than
 * vanishing. That distinction is the actionable part of this section: unassessed is
 * what to ask a mentor about.
 */
const buildReadiness = async (user, profile) => {
  const flags = await readinessFlagService.listMyReadinessFlags(user);
  const technologies = buildTechnologyReadiness(profile.selfTechnologies || [], flags);

  return {
    position: buildPositionReadiness(profile.declaredPosition, flags),
    technologies,
    summary: summarizeReadiness(technologies),
  };
};

/**
 * Every recommendation the intern has ever been part of, newest activity first.
 *
 * Reuses `listOwnRecommendations` rather than re-querying: it already resolves the
 * intern from the authenticated user and already returns the redacted
 * `formatOwnRecommendation` shape, which withholds the admin's recommendation
 * note, the interviewer's feedback and the reasoning behind a placement decision.
 * Don't widen it from here — that formatter is the single place that decides what
 * an intern sees of a recommendation.
 */
const buildRecommendations = async (user) => {
  const items = await recommendationService.listOwnRecommendations(user);
  return { total: items.length, items };
};

/**
 * Notes an admin or mentor chose, at write time, to share directly with the
 * intern they're about. Reuses `mentorCommentService.listComments` rather than
 * querying `MentorComment` here — that function is the one place that decides
 * what an intern is allowed to see of it, and this stays in agreement with it by
 * construction rather than by two implementations happening to match.
 */
const buildMentorNotes = async (user) => {
  const items = await mentorCommentService.listComments(user, user._id);
  return { total: items.length, items };
};

/**
 * The whole page in one payload.
 *
 * One endpoint rather than four so the page has one loading state, one error
 * state and one cache key to invalidate when an admin records something — which
 * is what makes the socket refresh (`emitInternDataChanged`) land on all four
 * sections at once instead of three of them.
 *
 * Attendance is deliberately absent: `/my-attendance` owns it, the hero on the
 * dashboard already reads `GET /api/attendance/me`, and a third copy of the same
 * month's numbers is a third thing to keep in agreement. The page links there.
 */
const getInternProgress = async (user) => {
  // Throws 404 when the user has no `InternProfile`. That is the honest answer
  // for this page — every section below hangs off the profile — and the client
  // renders the message rather than four empty panels that read as "no progress".
  const profile = await internService.getMyInternProfile(user);

  const [evaluations, readiness, recommendations, mentorNotes] = await Promise.all([
    buildEvaluations(user),
    buildReadiness(user, profile),
    buildRecommendations(user),
    buildMentorNotes(user),
  ]);

  return {
    programme: buildProgramme(profile),
    evaluations,
    readiness,
    recommendations,
    mentorNotes,
  };
};

module.exports = { getInternProgress };
