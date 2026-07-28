/**
 * Phase 3 — talent management: readiness flags, evaluations, mentor comments,
 * and the placement pipeline (recommendations + interviews + outcomes).
 *
 * Runs after phaseWorkspace because Recommendation.project is required and
 * points at the client projects created there (falling back to the locked
 * `unspecified` sentinel, which the wipe preserves).
 */

const ReadinessFlag = require('../../models/ReadinessFlag');
const Evaluation = require('../../models/Evaluation');
const MentorComment = require('../../models/MentorComment');
const Recommendation = require('../../models/Recommendation');
const History = require('../../models/History');
const { stableId } = require('./clock');
const { buildRecommendationDoc, buildStatusHistory } = require('./recommendationDocs');

// Which evaluation/note profile an intern gets. Terminal statuses use `alumni`;
// everyone else is keyed by their attendance persona so the scores and the
// attendance rate on screen tell the same story.
const profileKeyFor = (spec) => spec.attendance?.persona || 'alumni';

const createReadinessFlags = async (ctx) => {
  const docs = [];
  // Readiness is admin-only (readinessFlagService rejects non-admins), so the
  // admin is the one who set these — crediting a mentor would contradict the
  // permission model the demo is showing.
  const setBy = ctx.users.get('admin');

  for (const spec of ctx.data.interns) {
    const profile = ctx.profiles.get(spec.key);

    (spec.readiness || []).forEach((flag, index) => {
      // pre('validate') enforces exactly one of technology/position, and the
      // unique { internProfile, technology } index means at most one position
      // flag per intern (position flags carry technology: null).
      docs.push({
        _id: stableId(`readiness:${spec.key}:${index}`),
        internProfile: profile._id,
        technology: flag.technology ? ctx.ref.techBySlug(flag.technology)._id : null,
        position: flag.position ? ctx.ref.positionBySlug(flag.position)._id : null,
        level: flag.level,
        setBy: setBy._id,
      });
    });
  }
  // insertMany runs validators by default, so the XOR guard still applies.
  await ReadinessFlag.insertMany(docs);
  ctx.counts.readinessFlags = docs.length;
};

const createEvaluations = async (ctx) => {
  const { data, clock } = ctx;
  const docs = [];

  // Evaluations are admin-only too (evaluationService: "mentors and interns
  // can't view them"), so the admin is the evaluator of record.
  const evaluator = ctx.users.get('admin');

  for (const spec of data.interns) {
    const profile = ctx.profiles.get(spec.key);
    const band = data.evaluationProfiles[profileKeyFor(spec)];
    // Interns with under ~8 weeks of tenure have only had one review cycle.
    const cycles = spec.startWorkdaysAgo >= 40 ? 2 : 1;

    for (let cycle = 0; cycle < cycles; cycle += 1) {
      // Most recent cycle ends 5 working days ago; the earlier one 45 before that.
      const endAgo = cycle === cycles - 1 ? 5 : 50;
      const startAgo = endAgo + 20;
      docs.push({
        _id: stableId(`evaluation:${spec.key}:${cycle}`),
        internProfile: profile._id,
        evaluator: evaluator._id,
        periodStart: clock.startOfDay(clock.workdaysAgo(startAgo)),
        periodEnd: clock.startOfDay(clock.workdaysAgo(endAgo)),
        scores: cycles === 1 || cycle === 1 ? band.second : band.first,
        notes: cycles === 1 || cycle === 1 ? band.secondNotes : band.firstNotes,
      });
    }
  }

  await Evaluation.insertMany(docs);
  ctx.counts.evaluations = docs.length;
};

const createMentorComments = async (ctx) => {
  const { data, clock } = ctx;
  const docs = [];

  // A note is readable by its author plus whoever is on `visibleTo` — nobody
  // else, however senior. So a shared note has to name the admin and leadership
  // explicitly, or the admin's intern page shows no notes at all.
  const sharedWith = [ctx.users.get('admin')._id, ctx.users.get('leadership')._id];

  for (const spec of data.interns) {
    const pool = data.mentorNotePools[profileKeyFor(spec)];
    pool.forEach((note, index) => {
      docs.push({
        _id: stableId(`mentorComment:${spec.key}:${index}`),
        internProfile: ctx.profiles.get(spec.key)._id,
        author: ctx.users.get(spec.mentorKey)._id,
        content: note.text,
        visibleTo: note.shared ? sharedWith : [],
        createdAt: clock.at(clock.workdaysAgo(6 + index * 9), 17, 15),
      });
    });
  }

  await MentorComment.insertMany(docs);
  ctx.counts.mentorComments = docs.length;
};

const createRecommendations = async (ctx) => {
  const { data, clock } = ctx;
  const historyDocs = [];

  for (const spec of data.recommendations) {
    const author = ctx.users.get(spec.createdByKey);
    const project = spec.projectKey
      ? ctx.projects.get(spec.projectKey)
      : ctx.ref.unspecifiedProject;

    const { doc, statusDates } = buildRecommendationDoc(spec, clock, {
      internProfileId: ctx.profiles.get(spec.internKey)._id,
      authorId: author._id,
      positionId: ctx.ref.positionBySlug(spec.positionSlug)._id,
      projectId: project._id,
      technologyIds: (spec.technologies || []).map((slug) => ctx.ref.techBySlug(slug)._id),
      decidedById: spec.result ? ctx.users.get(spec.result.decidedByKey)._id : undefined,
    });

    const recommendation = await Recommendation.create(doc);
    historyDocs.push(...buildStatusHistory(spec, recommendation._id, statusDates, author));
  }

  await History.insertMany(historyDocs);
  ctx.counts.recommendations = data.recommendations.length;
  ctx.counts.history = (ctx.counts.history || 0) + historyDocs.length;
};

const run = async (ctx) => {
  await createReadinessFlags(ctx);
  await createEvaluations(ctx);
  await createMentorComments(ctx);
  await createRecommendations(ctx);
};

module.exports = { run };
